import * as BS from "../node_modules/brilliantsole/build/brilliantsole.module.js";
window.BS = BS;
console.log({ BS });
//BS.setAllConsoleLevelFlags({ log: true });

// CLIENT

const client = new BS.WebSocketClient();
console.log({ client });
window.client = client;

// SEARCH PARAMS

const url = new URL(location);
function setUrlParam(key, value) {
  if (history.pushState) {
    let searchParams = new URLSearchParams(window.location.search);
    if (value) {
      searchParams.set(key, value);
    } else {
      searchParams.delete(key);
    }
    let newUrl =
      window.location.protocol +
      "//" +
      window.location.host +
      window.location.pathname +
      "?" +
      searchParams.toString();
    window.history.pushState({ path: newUrl }, "", newUrl);
  }
}
client.addEventListener("isConnected", () => {
  if (client.isConnected) {
    setUrlParam("webSocketUrl", client.webSocket.url);
    webSocketUrlInput.value = client.webSocket.url;
  } else {
    setUrlParam("webSocketUrl");
  }
});

// CONNECTION

/** @type {HTMLInputElement} */
const webSocketUrlInput = document.getElementById("webSocketUrl");
webSocketUrlInput.value = url.searchParams.get("webSocketUrl") || "";
client.addEventListener("isConnected", () => {
  webSocketUrlInput.disabled = client.isConnected;
});

/** @type {HTMLButtonElement} */
const toggleConnectionButton = document.getElementById("toggleConnection");
toggleConnectionButton.addEventListener("click", () => {
  if (client.isConnected) {
    client.disconnect();
  } else {
    /** @type {string?} */
    let webSocketUrl;
    if (webSocketUrlInput.value.length > 0) {
      webSocketUrl = webSocketUrlInput.value;
    }
    webSocketUrl = client.connect(webSocketUrl);
  }
});
client.addEventListener("connectionStatus", () => {
  switch (client.connectionStatus) {
    case "connected":
    case "notConnected":
      toggleConnectionButton.disabled = false;
      toggleConnectionButton.innerText = client.isConnected
        ? "disconnect"
        : "connect";
      break;
    case "connecting":
    case "disconnecting":
      toggleConnectionButton.innerText = client.connectionStatus;
      toggleConnectionButton.disabled = true;
      break;
  }
});

// SCANNER

/** @type {HTMLInputElement} */
const isScanningAvailableCheckbox = document.getElementById(
  "isScanningAvailable"
);
client.addEventListener("isScanningAvailable", () => {
  isScanningAvailableCheckbox.checked = client.isScanningAvailable;
});

/** @type {HTMLButtonElement} */
const toggleScanButton = document.getElementById("toggleScan");
toggleScanButton.addEventListener("click", () => {
  client.toggleScan();
});
client.addEventListener("isScanningAvailable", () => {
  toggleScanButton.disabled = !client.isScanningAvailable;
});
client.addEventListener("isScanning", () => {
  toggleScanButton.innerText = client.isScanning ? "stop scanning" : "scan";
});

// DISCOVERED DEVICES

/** @type {HTMLTemplateElement} */
const discoveredDeviceTemplate = document.getElementById(
  "discoveredDeviceTemplate"
);
const discoveredDevicesContainer = document.getElementById("discoveredDevices");
/** @type {Object.<string, HTMLElement>} */
let discoveredDeviceContainers = {};

client.addEventListener("discoveredDevice", (event) => {
  const discoveredDevice = event.message.discoveredDevice;

  let discoveredDeviceContainer =
    discoveredDeviceContainers[discoveredDevice.bluetoothId];
  if (!discoveredDeviceContainer) {
    discoveredDeviceContainer = discoveredDeviceTemplate.content
      .cloneNode(true)
      .querySelector(".discoveredDevice");

    /** @type {HTMLButtonElement} */
    const toggleConnectionButton =
      discoveredDeviceContainer.querySelector(".toggleConnection");
    toggleConnectionButton.addEventListener("click", () => {
      let device = client.devices[discoveredDevice.bluetoothId];
      if (device) {
        device.toggleConnection();
      } else {
        device = client.connectToDevice(discoveredDevice.bluetoothId);
        onDevice(device);
      }
    });

    /** @param {BS.Device} device */
    const onDevice = (device) => {
      device.addEventListener("connectionStatus", () => {
        updateToggleConnectionButton(device);
      });
      updateToggleConnectionButton(device);
      delete discoveredDeviceContainer._onDevice;
    };

    discoveredDeviceContainer._onDevice = onDevice;

    /** @param {BS.Device} device */
    const updateToggleConnectionButton = (device) => {
      console.log({ deviceConnectionStatus: device.connectionStatus });
      switch (device.connectionStatus) {
        case "connected":
        case "notConnected":
          toggleConnectionButton.innerText = device.isConnected
            ? "disconnect"
            : "connect";
          toggleConnectionButton.disabled = false;
          break;
        case "connecting":
        case "disconnecting":
          toggleConnectionButton.innerText = device.connectionStatus;
          toggleConnectionButton.disabled = true;
          break;
      }
    };

    discoveredDeviceContainers[discoveredDevice.bluetoothId] =
      discoveredDeviceContainer;
    discoveredDevicesContainer.appendChild(discoveredDeviceContainer);
  }

  updateDiscoveredDeviceContainer(discoveredDevice);
});

/** @param {BS.DiscoveredDevice} discoveredDevice */
function updateDiscoveredDeviceContainer(discoveredDevice) {
  const discoveredDeviceContainer =
    discoveredDeviceContainers[discoveredDevice.bluetoothId];
  if (!discoveredDeviceContainer) {
    console.warn(
      `no discoveredDeviceContainer for device id ${discoveredDevice.bluetoothId}`
    );
    return;
  }
  discoveredDeviceContainer.querySelector(".name").innerText =
    discoveredDevice.name;
  discoveredDeviceContainer.querySelector(".rssi").innerText =
    discoveredDevice.rssi;
  discoveredDeviceContainer.querySelector(".deviceType").innerText =
    discoveredDevice.deviceType;
}

/** @param {BS.DiscoveredDevice} discoveredDevice */
function removeDiscoveredDeviceContainer(discoveredDevice) {
  const discoveredDeviceContainer =
    discoveredDeviceContainers[discoveredDevice.bluetoothId];
  if (!discoveredDeviceContainer) {
    console.warn(
      `no discoveredDeviceContainer for device id ${discoveredDevice.bluetoothId}`
    );
    return;
  }

  discoveredDeviceContainer.remove();
  delete discoveredDeviceContainers[discoveredDevice.bluetoothId];
}

client.addEventListener("expiredDiscoveredDevice", (event) => {
  const discoveredDevice = event.message.discoveredDevice;
  removeDiscoveredDeviceContainer(discoveredDevice);
});

function clearDiscoveredDevices() {
  discoveredDevicesContainer.innerHTML = "";
  discoveredDeviceContainers = {};
}

client.addEventListener("notConnected", () => {
  clearDiscoveredDevices();
});

client.addEventListener("isScanning", () => {
  if (client.isScanning) {
    clearDiscoveredDevices();
  }
});

BS.DeviceManager.AddEventListener("deviceIsConnected", (event) => {
  const device = event.message.device;
  console.log("deviceIsConnected", device);
  const discoveredDeviceContainer =
    discoveredDeviceContainers[device.bluetoothId];
  if (!discoveredDeviceContainer) {
    return;
  }
  discoveredDeviceContainer._onDevice?.(device);
});

// AVAILABLE DEVICES

/** @type {HTMLTemplateElement} */
const connectedDeviceTemplate = document.getElementById(
  "connectedDeviceTemplate"
);
const connectedDevicesContainer = document.getElementById("connectedDevices");
/** @type {Object.<string, HTMLElement>} */
let connectedDeviceContainers = {};

BS.DeviceManager.AddEventListener("connectedDevices", (event) => {
  const { connectedDevices } = event.message;
  console.log({ connectedDevices });

  connectedDevices.forEach((device) => {
    if (device.connectionType != "client" || !device.bluetoothId) {
      return;
    }
    let connectedDeviceContainer =
      connectedDeviceContainers[device.bluetoothId];
    if (!connectedDeviceContainer) {
      connectedDeviceContainer = connectedDeviceTemplate.content
        .cloneNode(true)
        .querySelector(".connectedDevice");
      connectedDeviceContainers[device.bluetoothId] = connectedDeviceContainer;

      // DEVICE INFORMATION
      /** @type {HTMLPreElement} */
      const deviceInformationPre =
        connectedDeviceContainer.querySelector(".deviceInformation");
      const setDeviceInformationPre = () =>
        (deviceInformationPre.textContent = JSON.stringify(
          device.deviceInformation,
          null,
          2
        ));
      setDeviceInformationPre();
      device.addEventListener("deviceInformation", () =>
        setDeviceInformationPre()
      );

      // DEVICE BATTERY
      /** @type {HTMLSpanElement} */
      const batteryLevelSpan =
        connectedDeviceContainer.querySelector(".batteryLevel");
      const setBatteryLevelSpan = () =>
        (batteryLevelSpan.innerText = device.batteryLevel);
      setBatteryLevelSpan();
      device.addEventListener("batteryLevel", () => setBatteryLevelSpan());

      // DEVICE NAME
      /** @type {HTMLSpanElement} */
      const nameSpan = connectedDeviceContainer.querySelector(".name");
      const setNameSpan = () => (nameSpan.innerText = device.name);
      setNameSpan();
      device.addEventListener("getName", () => setNameSpan());

      // DEVICE TYPE
      /** @type {HTMLSpanElement} */
      const deviceTypeSpan =
        connectedDeviceContainer.querySelector(".deviceType");
      const setDeviceTypeSpan = () => (deviceTypeSpan.innerText = device.type);
      setDeviceTypeSpan();
      device.addEventListener("getType", () => setDeviceTypeSpan());

      // DEVICE SENSOR CONFIGURATION
      /** @type {HTMLPreElement} */
      const sensorConfigurationPre = connectedDeviceContainer.querySelector(
        ".sensorConfiguration"
      );
      const setSensorConfigurationPre = () =>
        (sensorConfigurationPre.textContent = JSON.stringify(
          device.sensorConfiguration,
          null,
          2
        ));
      setSensorConfigurationPre();
      device.addEventListener("getSensorConfiguration", () =>
        setSensorConfigurationPre()
      );

      /** @type {HTMLTemplateElement} */
      const sensorTypeConfigurationTemplate =
        connectedDeviceContainer.querySelector(
          ".sensorTypeConfigurationTemplate"
        );
      device.sensorTypes.forEach((sensorType) => {
        const sensorTypeConfigurationContainer =
          sensorTypeConfigurationTemplate.content
            .cloneNode(true)
            .querySelector(".sensorTypeConfiguration");
        sensorTypeConfigurationContainer.querySelector(
          ".sensorType"
        ).innerText = sensorType;

        /** @type {HTMLInputElement} */
        const sensorRateInput =
          sensorTypeConfigurationContainer.querySelector(".sensorRate");
        sensorRateInput.value = 0;
        sensorRateInput.max = BS.MaxSensorRate;
        sensorRateInput.step = BS.SensorRateStep;
        sensorRateInput.addEventListener("input", () => {
          const sensorRate = Number(sensorRateInput.value);
          console.log({ sensorType, sensorRate });
          device.setSensorConfiguration({ [sensorType]: sensorRate });
        });
        sensorRateInput.disabled = !device.isConnected;

        sensorTypeConfigurationTemplate.parentElement.insertBefore(
          sensorTypeConfigurationContainer,
          sensorTypeConfigurationTemplate
        );
        sensorTypeConfigurationContainer.dataset.sensorType = sensorType;
      });

      device.addEventListener("isConnected", () => {
        connectedDeviceContainer
          .querySelectorAll("input")
          .forEach((input) => (input.disabled = !device.isConnected));
      });

      device.addEventListener("getSensorConfiguration", () => {
        for (const sensorType in device.sensorConfiguration) {
          connectedDeviceContainer.querySelector(
            `.sensorTypeConfiguration[data-sensor-type="${sensorType}"] .input`
          ).value = device.sensorConfiguration[sensorType];
        }
      });

      // DEVICE SENSOR DATA
      /** @type {HTMLPreElement} */
      const sensorDataPre =
        connectedDeviceContainer.querySelector(".sensorData");
      const setSensorDataPre = (event) =>
        (sensorDataPre.textContent = JSON.stringify(event.message, null, 2));
      device.addEventListener("sensorData", (event) => setSensorDataPre(event));

      // DEVICE CONNECTION
      /** @type {HTMLButtonElement} */
      const toggleConnectionButton =
        connectedDeviceContainer.querySelector(".toggleConnection");
      toggleConnectionButton.addEventListener("click", () => {
        device.toggleConnection();
      });
      const updateToggleConnectionButton = () => {
        switch (device.connectionStatus) {
          case "connected":
          case "notConnected":
            toggleConnectionButton.disabled = false;
            toggleConnectionButton.innerText = device.isConnected
              ? "disconnect"
              : "connect";
            break;
          case "connecting":
          case "disconnecting":
            toggleConnectionButton.innerText = device.connectionStatus;
            toggleConnectionButton.disabled = true;
            break;
        }
      };
      updateToggleConnectionButton();
      device.addEventListener("connectionStatus", () =>
        updateToggleConnectionButton()
      );

      // DEVICE CAMERA
      const deviceCameraContaner =
        connectedDeviceContainer.querySelector(".camera");

      /** @type {HTMLImageElement} */
      const deviceCameraImage =
        deviceCameraContaner.querySelector(".cameraImage");
      device.addEventListener("cameraImage", (event) => {
        deviceCameraImage.src = event.message.url;
      });

      /** @type {HTMLButtonElement} */
      const takePictureButton =
        deviceCameraContaner.querySelector(".takePicture");
      takePictureButton.addEventListener("click", () => {
        device.takePicture();
      });
      const updateTakePictureButton = () => {
        const { cameraStatus } = device;
        let innerText = "take picture";
        let enabled = false;
        switch (cameraStatus) {
          case "takingPicture":
            innerText = "taking picture...";
            enabled = true;
            break;
          case "idle":
            enabled = true;
            break;
          case "focusing":
            break;
          case "asleep":
            break;
        }
        takePictureButton.disabled = !enabled;
        takePictureButton.innerText = innerText;
      };
      device.addEventListener("cameraStatus", () => {
        updateTakePictureButton();
      });

      /** @type {HTMLButtonElement} */
      const focusCameraButton =
        deviceCameraContaner.querySelector(".focusCamera");
      focusCameraButton.addEventListener("click", () => {
        device.focusCamera();
      });
      const updateFocusCameraButton = () => {
        const { cameraStatus } = device;
        let innerText = "focus camera";
        let enabled = false;
        switch (cameraStatus) {
          case "takingPicture":
            break;
          case "idle":
            enabled = true;
            break;
          case "focusing":
            innerText = "focusing...";
            break;
          case "asleep":
            break;
        }
        focusCameraButton.disabled = !enabled;
        focusCameraButton.innerText = innerText;
      };
      device.addEventListener("cameraStatus", () => {
        updateFocusCameraButton();
      });
      device.addEventListener("cameraStatus", (event) => {
        const { previousCameraStatus } = event.message;
        if (previousCameraStatus == "focusing") {
          device.takePicture();
        }
      });

      let autoPicture = false;
      /** @type {HTMLButtonElement} */
      const autoPictureCheckbox =
        deviceCameraContaner.querySelector(".autoPicture");
      autoPictureCheckbox.addEventListener("input", () => {
        autoPicture = autoPictureCheckbox.checked;
        console.log({ autoPicture });
      });
      autoPictureCheckbox.checked = autoPicture;
      device.addEventListener("cameraImage", () => {
        if (autoPicture) {
          device.takePicture();
        }
      });

      /** @type {HTMLPreElement} */
      const cameraConfigurationPre = deviceCameraContaner.querySelector(
        ".cameraConfigurationPre"
      );
      const updateCameraConfigurationPre = () => {
        cameraConfigurationPre.textContent = JSON.stringify(
          device.cameraConfiguration,
          null,
          2
        );
      };
      device.addEventListener("getCameraConfiguration", () => {
        updateCameraConfigurationPre();
        updateCameraWhiteBalanceInput();
      });

      /** @type {HTMLInputElement} */
      const takePictureAfterUpdateCheckbox = deviceCameraContaner.querySelector(
        ".takePictureAfterUpdate"
      );
      let takePictureAfterUpdate = false;
      takePictureAfterUpdateCheckbox.addEventListener("input", () => {
        takePictureAfterUpdate = takePictureAfterUpdateCheckbox.checked;
        console.log({ takePictureAfterUpdate });
      });

      const cameraConfigurationContainer = deviceCameraContaner.querySelector(
        ".cameraConfiguration"
      );
      /** @type {HTMLTemplateElement} */
      const cameraConfigurationTypeTemplate =
        deviceCameraContaner.querySelector(".cameraConfigurationTypeTemplate");
      BS.CameraConfigurationTypes.forEach((cameraConfigurationType) => {
        const cameraConfigurationTypeContainer =
          cameraConfigurationTypeTemplate.content
            .cloneNode(true)
            .querySelector(".cameraConfigurationType");

        cameraConfigurationContainer.appendChild(
          cameraConfigurationTypeContainer
        );

        cameraConfigurationTypeContainer.querySelector(".type").innerText =
          cameraConfigurationType;

        /** @type {HTMLInputElement} */
        const input = cameraConfigurationTypeContainer.querySelector("input");

        /** @type {HTMLSpanElement} */
        const span = cameraConfigurationTypeContainer.querySelector("span");

        device.addEventListener("isConnected", () => {
          updateisInputDisabled();
        });
        device.addEventListener("cameraStatus", () => {
          updateisInputDisabled();
        });
        const updateisInputDisabled = () => {
          input.disabled =
            !device.isConnected ||
            !device.hasCamera ||
            device.cameraStatus != "idle";
        };
        updateisInputDisabled();

        const updateInput = () => {
          const value = device.cameraConfiguration[cameraConfigurationType];
          span.innerText = value;
          input.value = value;
        };

        const updateRange = () => {
          if (!device.hasCamera) {
            return;
          }
          const range =
            device.cameraConfigurationRanges[cameraConfigurationType];
          input.min = range.min;
          input.max = range.max;
        };
        device.addEventListener("connected", () => {
          updateRange();
          updateInput();
        });
        updateRange();
        updateInput();

        device.addEventListener("getCameraConfiguration", () => {
          updateInput();
        });

        input.addEventListener("change", () => {
          const value = Number(input.value);
          // console.log(`updating ${cameraConfigurationType} to ${value}`);
          device.setCameraConfiguration({
            [cameraConfigurationType]: value,
          });
          if (takePictureAfterUpdate) {
            device.addEventListener(
              "getCameraConfiguration",
              () => {
                setTimeout(() => device.takePicture()), 100;
              },
              { once: true }
            );
          }
        });
      });

      /** @type {HTMLInputElement} */
      const cameraWhiteBalanceInput = deviceCameraContaner.querySelector(
        ".cameraWhiteBalance"
      );
      const updateWhiteBalance = BS.ThrottleUtils.throttle(
        (config) => {
          if (device.cameraStatus != "idle") {
            return;
          }

          device.setCameraConfiguration(config);

          if (takePictureAfterUpdate) {
            device.addEventListener(
              "getCameraConfiguration",
              () => {
                setTimeout(() => device.takePicture()), 100;
              },
              { once: true }
            );
          }
        },
        200,
        true
      );
      cameraWhiteBalanceInput.addEventListener("input", () => {
        let [redGain, greenGain, blueGain] = cameraWhiteBalanceInput.value
          .replace("#", "")
          .match(/.{1,2}/g)
          .map((value) => Number(`0x${value}`))
          .map((value) => value / 255)
          .map((value) => value * device.cameraConfigurationRanges.blueGain.max)
          .map((value) => Math.round(value));

        updateWhiteBalance({ redGain, greenGain, blueGain });
      });
      const updateCameraWhiteBalanceInput = () => {
        if (!device.hasCamera) {
          return;
        }
        cameraWhiteBalanceInput.disabled =
          !device.isConnected ||
          !device.hasCamera ||
          device.cameraStatus != "idle";

        const { redGain, blueGain, greenGain } = device.cameraConfiguration;

        cameraWhiteBalanceInput.value = `#${[redGain, blueGain, greenGain]
          .map((value) => value / device.cameraConfigurationRanges.redGain.max)
          .map((value) => value * 255)
          .map((value) => Math.round(value))
          .map((value) => value.toString(16))
          .join("")}`;
      };

      device.addEventListener("cameraStatus", () => {
        updateCameraWhiteBalanceInput();
      });

      const updateDeviceCameraContainer = () => {
        if (device.isConnected) {
          deviceCameraContaner.removeAttribute("hidden");
        } else {
          deviceCameraContaner.setAttribute("hidden", "");
        }
        updateFocusCameraButton();
        updateTakePictureButton();
        updateCameraConfigurationPre();
        updateCameraWhiteBalanceInput();
      };
      device.addEventListener("isConnected", () => {
        updateDeviceCameraContainer();
      });
      updateDeviceCameraContainer();

      // DEVICE MICROPHONE
      // FILL
    }
    connectedDevicesContainer.appendChild(connectedDeviceContainer);
  });

  for (const id in connectedDeviceContainers) {
    const connectedDevice = connectedDevices.find(
      (connectedDevice) => connectedDevice.bluetoothId == id
    );
    if (!connectedDevice) {
      console.log("remove", id);
      connectedDeviceContainers[id].remove();
      //delete connectedDeviceContainers[id];
    }
  }
});
