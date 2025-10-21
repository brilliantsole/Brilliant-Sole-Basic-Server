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

      /** @type {HTMLSpanElement} */
      const batteryLevelSpan =
        connectedDeviceContainer.querySelector(".batteryLevel");
      const setBatteryLevelSpan = () =>
        (batteryLevelSpan.innerText = device.batteryLevel);
      setBatteryLevelSpan();
      device.addEventListener("batteryLevel", () => setBatteryLevelSpan());

      /** @type {HTMLSpanElement} */
      const nameSpan = connectedDeviceContainer.querySelector(".name");
      const setNameSpan = () => (nameSpan.innerText = device.name);
      setNameSpan();
      device.addEventListener("getName", () => setNameSpan());

      /** @type {HTMLSpanElement} */
      const deviceTypeSpan =
        connectedDeviceContainer.querySelector(".deviceType");
      const setDeviceTypeSpan = () => (deviceTypeSpan.innerText = device.type);
      setDeviceTypeSpan();
      device.addEventListener("getType", () => setDeviceTypeSpan());

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

      /** @type {HTMLPreElement} */
      const sensorDataPre =
        connectedDeviceContainer.querySelector(".sensorData");
      const setSensorDataPre = (event) =>
        (sensorDataPre.textContent = JSON.stringify(event.message, null, 2));
      device.addEventListener("sensorData", (event) => setSensorDataPre(event));

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
