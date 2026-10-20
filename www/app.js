(() => {
  // node_modules/@capacitor/core/dist/index.js
  var ExceptionCode;
  (function(ExceptionCode2) {
    ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
    ExceptionCode2["Unavailable"] = "UNAVAILABLE";
  })(ExceptionCode || (ExceptionCode = {}));
  var CapacitorException = class extends Error {
    constructor(message, code, data) {
      super(message);
      this.message = message;
      this.code = code;
      this.data = data;
    }
  };
  var getPlatformId = (win) => {
    var _a, _b;
    if (win === null || win === void 0 ? void 0 : win.androidBridge) {
      return "android";
    } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
      return "ios";
    } else {
      return "web";
    }
  };
  var createCapacitor = (win) => {
    const capCustomPlatform = win.CapacitorCustomPlatform || null;
    const cap = win.Capacitor || {};
    const Plugins = cap.Plugins = cap.Plugins || {};
    const getPlatform = () => {
      return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
    };
    const isNativePlatform = () => getPlatform() !== "web";
    const isPluginAvailable = (pluginName) => {
      const plugin = registeredPlugins.get(pluginName);
      if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
        return true;
      }
      if (getPluginHeader(pluginName)) {
        return true;
      }
      return false;
    };
    const getPluginHeader = (pluginName) => {
      var _a;
      return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
    };
    const handleError = (err) => win.console.error(err);
    const registeredPlugins = /* @__PURE__ */ new Map();
    const registerPlugin2 = (pluginName, jsImplementations = {}) => {
      const registeredPlugin = registeredPlugins.get(pluginName);
      if (registeredPlugin) {
        console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
        return registeredPlugin.proxy;
      }
      const platform = getPlatform();
      const pluginHeader = getPluginHeader(pluginName);
      let jsImplementation;
      const loadPluginImplementation = async () => {
        if (!jsImplementation && platform in jsImplementations) {
          jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
        } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
          jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
        }
        return jsImplementation;
      };
      const createPluginMethod = (impl, prop) => {
        var _a, _b;
        if (pluginHeader) {
          const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
          if (methodHeader) {
            if (methodHeader.rtype === "promise") {
              return (options) => cap.nativePromise(pluginName, prop.toString(), options);
            } else {
              return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
            }
          } else if (impl) {
            return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
          }
        } else if (impl) {
          return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
        } else {
          throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
        }
      };
      const createPluginMethodWrapper = (prop) => {
        let remove;
        const wrapper = (...args) => {
          const p = loadPluginImplementation().then((impl) => {
            const fn = createPluginMethod(impl, prop);
            if (fn) {
              const p2 = fn(...args);
              remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
              return p2;
            } else {
              throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
            }
          });
          if (prop === "addListener") {
            p.remove = async () => remove();
          }
          return p;
        };
        wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
        Object.defineProperty(wrapper, "name", {
          value: prop,
          writable: false,
          configurable: false
        });
        return wrapper;
      };
      const addListener = createPluginMethodWrapper("addListener");
      const removeListener = createPluginMethodWrapper("removeListener");
      const addListenerNative = (eventName, callback) => {
        const call = addListener({ eventName }, callback);
        const remove = async () => {
          const callbackId = await call;
          removeListener({
            eventName,
            callbackId
          }, callback);
        };
        const p = new Promise((resolve) => call.then(() => resolve({ remove })));
        p.remove = async () => {
          console.warn(`Using addListener() without 'await' is deprecated.`);
          await remove();
        };
        return p;
      };
      const proxy = new Proxy({}, {
        get(_, prop) {
          switch (prop) {
            // https://github.com/facebook/react/issues/20030
            case "$$typeof":
              return void 0;
            case "toJSON":
              return () => ({});
            case "addListener":
              return pluginHeader ? addListenerNative : addListener;
            case "removeListener":
              return removeListener;
            default:
              return createPluginMethodWrapper(prop);
          }
        }
      });
      Plugins[pluginName] = proxy;
      registeredPlugins.set(pluginName, {
        name: pluginName,
        proxy,
        platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
      });
      return proxy;
    };
    if (!cap.convertFileSrc) {
      cap.convertFileSrc = (filePath) => filePath;
    }
    cap.getPlatform = getPlatform;
    cap.handleError = handleError;
    cap.isNativePlatform = isNativePlatform;
    cap.isPluginAvailable = isPluginAvailable;
    cap.registerPlugin = registerPlugin2;
    cap.Exception = CapacitorException;
    cap.DEBUG = !!cap.DEBUG;
    cap.isLoggingEnabled = !!cap.isLoggingEnabled;
    return cap;
  };
  var initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
  var Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
  var registerPlugin = Capacitor.registerPlugin;
  var WebPlugin = class {
    constructor() {
      this.listeners = {};
      this.retainedEventArguments = {};
      this.windowListeners = {};
    }
    addListener(eventName, listenerFunc) {
      let firstListener = false;
      const listeners = this.listeners[eventName];
      if (!listeners) {
        this.listeners[eventName] = [];
        firstListener = true;
      }
      this.listeners[eventName].push(listenerFunc);
      const windowListener = this.windowListeners[eventName];
      if (windowListener && !windowListener.registered) {
        this.addWindowListener(windowListener);
      }
      if (firstListener) {
        this.sendRetainedArgumentsForEvent(eventName);
      }
      const remove = async () => this.removeListener(eventName, listenerFunc);
      const p = Promise.resolve({ remove });
      return p;
    }
    async removeAllListeners() {
      this.listeners = {};
      for (const listener in this.windowListeners) {
        this.removeWindowListener(this.windowListeners[listener]);
      }
      this.windowListeners = {};
    }
    notifyListeners(eventName, data, retainUntilConsumed) {
      const listeners = this.listeners[eventName];
      if (!listeners) {
        if (retainUntilConsumed) {
          let args = this.retainedEventArguments[eventName];
          if (!args) {
            args = [];
          }
          args.push(data);
          this.retainedEventArguments[eventName] = args;
        }
        return;
      }
      listeners.forEach((listener) => listener(data));
    }
    hasListeners(eventName) {
      var _a;
      return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
    }
    registerWindowListener(windowEventName, pluginEventName) {
      this.windowListeners[pluginEventName] = {
        registered: false,
        windowEventName,
        pluginEventName,
        handler: (event) => {
          this.notifyListeners(pluginEventName, event);
        }
      };
    }
    unimplemented(msg = "not implemented") {
      return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
    }
    unavailable(msg = "not available") {
      return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
    }
    async removeListener(eventName, listenerFunc) {
      const listeners = this.listeners[eventName];
      if (!listeners) {
        return;
      }
      const index = listeners.indexOf(listenerFunc);
      if (index !== -1) {
        this.listeners[eventName].splice(index, 1);
      }
      if (!this.listeners[eventName].length) {
        this.removeWindowListener(this.windowListeners[eventName]);
      }
    }
    addWindowListener(handle) {
      window.addEventListener(handle.windowEventName, handle.handler);
      handle.registered = true;
    }
    removeWindowListener(handle) {
      if (!handle) {
        return;
      }
      window.removeEventListener(handle.windowEventName, handle.handler);
      handle.registered = false;
    }
    sendRetainedArgumentsForEvent(eventName) {
      const args = this.retainedEventArguments[eventName];
      if (!args) {
        return;
      }
      delete this.retainedEventArguments[eventName];
      args.forEach((arg) => {
        this.notifyListeners(eventName, arg);
      });
    }
  };
  var encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
  var decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
  var CapacitorCookiesPluginWeb = class extends WebPlugin {
    async getCookies() {
      const cookies = document.cookie;
      const cookieMap = {};
      cookies.split(";").forEach((cookie) => {
        if (cookie.length <= 0)
          return;
        let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
        key = decode(key).trim();
        value = decode(value).trim();
        cookieMap[key] = value;
      });
      return cookieMap;
    }
    async setCookie(options) {
      try {
        const encodedKey = encode(options.key);
        const encodedValue = encode(options.value);
        const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
        const path = (options.path || "/").replace("path=", "");
        const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
        document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async deleteCookie(options) {
      try {
        document.cookie = `${options.key}=; Max-Age=0`;
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async clearCookies() {
      try {
        const cookies = document.cookie.split(";") || [];
        for (const cookie of cookies) {
          document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
        }
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async clearAllCookies() {
      try {
        await this.clearCookies();
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
  var CapacitorCookies = registerPlugin("CapacitorCookies", {
    web: () => new CapacitorCookiesPluginWeb()
  });
  var readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result;
      resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
  var normalizeHttpHeaders = (headers = {}) => {
    const originalKeys = Object.keys(headers);
    const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
    const normalized = loweredKeys.reduce((acc, key, index) => {
      acc[key] = headers[originalKeys[index]];
      return acc;
    }, {});
    return normalized;
  };
  var buildUrlParams = (params, shouldEncode = true) => {
    if (!params)
      return null;
    const output = Object.entries(params).reduce((accumulator, entry) => {
      const [key, value] = entry;
      let encodedValue;
      let item;
      if (Array.isArray(value)) {
        item = "";
        value.forEach((str) => {
          encodedValue = shouldEncode ? encodeURIComponent(str) : str;
          item += `${key}=${encodedValue}&`;
        });
        item.slice(0, -1);
      } else {
        encodedValue = shouldEncode ? encodeURIComponent(value) : value;
        item = `${key}=${encodedValue}`;
      }
      return `${accumulator}&${item}`;
    }, "");
    return output.substr(1);
  };
  var buildRequestInit = (options, extra = {}) => {
    const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
    const headers = normalizeHttpHeaders(options.headers);
    const type = headers["content-type"] || "";
    if (typeof options.data === "string") {
      output.body = options.data;
    } else if (type.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.data || {})) {
        params.set(key, value);
      }
      output.body = params.toString();
    } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
      const form = new FormData();
      if (options.data instanceof FormData) {
        options.data.forEach((value, key) => {
          form.append(key, value);
        });
      } else {
        for (const key of Object.keys(options.data)) {
          form.append(key, options.data[key]);
        }
      }
      output.body = form;
      const headers2 = new Headers(output.headers);
      headers2.delete("content-type");
      output.headers = headers2;
    } else if (type.includes("application/json") || typeof options.data === "object") {
      output.body = JSON.stringify(options.data);
    }
    return output;
  };
  var CapacitorHttpPluginWeb = class extends WebPlugin {
    /**
     * Perform an Http request given a set of options
     * @param options Options to build the HTTP request
     */
    async request(options) {
      const requestInit = buildRequestInit(options, options.webFetchExtra);
      const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
      const url = urlParams ? `${options.url}?${urlParams}` : options.url;
      const response = await fetch(url, requestInit);
      const contentType = response.headers.get("content-type") || "";
      let { responseType = "text" } = response.ok ? options : {};
      if (contentType.includes("application/json")) {
        responseType = "json";
      }
      let data;
      let blob;
      switch (responseType) {
        case "arraybuffer":
        case "blob":
          blob = await response.blob();
          data = await readBlobAsBase64(blob);
          break;
        case "json":
          data = await response.json();
          break;
        case "document":
        case "text":
        default:
          data = await response.text();
      }
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return {
        data,
        headers,
        status: response.status,
        url: response.url
      };
    }
    /**
     * Perform an Http GET request given a set of options
     * @param options Options to build the HTTP request
     */
    async get(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
    }
    /**
     * Perform an Http POST request given a set of options
     * @param options Options to build the HTTP request
     */
    async post(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
    }
    /**
     * Perform an Http PUT request given a set of options
     * @param options Options to build the HTTP request
     */
    async put(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
    }
    /**
     * Perform an Http PATCH request given a set of options
     * @param options Options to build the HTTP request
     */
    async patch(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
    }
    /**
     * Perform an Http DELETE request given a set of options
     * @param options Options to build the HTTP request
     */
    async delete(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
    }
  };
  var CapacitorHttp = registerPlugin("CapacitorHttp", {
    web: () => new CapacitorHttpPluginWeb()
  });
  var SystemBarsStyle;
  (function(SystemBarsStyle2) {
    SystemBarsStyle2["Dark"] = "DARK";
    SystemBarsStyle2["Light"] = "LIGHT";
    SystemBarsStyle2["Default"] = "DEFAULT";
  })(SystemBarsStyle || (SystemBarsStyle = {}));
  var SystemBarType;
  (function(SystemBarType2) {
    SystemBarType2["StatusBar"] = "StatusBar";
    SystemBarType2["NavigationBar"] = "NavigationBar";
  })(SystemBarType || (SystemBarType = {}));
  var SystemBarsPluginWeb = class extends WebPlugin {
    async setStyle() {
      this.unavailable("not available for web");
    }
    async setAnimation() {
      this.unavailable("not available for web");
    }
    async show() {
      this.unavailable("not available for web");
    }
    async hide() {
      this.unavailable("not available for web");
    }
  };
  var SystemBars = registerPlugin("SystemBars", {
    web: () => new SystemBarsPluginWeb()
  });

  // src/main.js
  var API = "https://transclick.in";
  var BG_PLUGIN = registerPlugin("BackgroundGeolocation");
  var SCANNER_PLUGIN = registerPlugin("BarcodeScanning");
  function getBG() {
    return BG_PLUGIN;
  }
  function getScanner() {
    return SCANNER_PLUGIN;
  }
  var state = {
    sessionId: null,
    bilty: null,
    // trip info for display
    biltyId: null,
    // QR path
    watcherId: null,
    pollTimer: null,
    awaitingClose: false
  };
  function $(id) {
    return document.getElementById(id);
  }
  function show(id) {
    var s = document.querySelectorAll(".screen");
    for (var i = 0; i < s.length; i++) s[i].classList.remove("active");
    $(id).classList.add("active");
  }
  function setErr(id, msg) {
    var e = $(id);
    if (!e) return;
    if (msg) {
      e.textContent = msg;
      e.classList.remove("hidden");
    } else {
      e.classList.add("hidden");
    }
  }
  function save() {
    try {
      if (state.sessionId) localStorage.setItem("tc_session", state.sessionId);
      if (state.bilty) localStorage.setItem("tc_bilty", JSON.stringify(state.bilty));
    } catch (e) {
    }
  }
  function clearSaved() {
    try {
      localStorage.removeItem("tc_session");
      localStorage.removeItem("tc_bilty");
    } catch (e) {
    }
  }
  function api(path, body) {
    return fetch(API + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : void 0,
      body: body ? JSON.stringify(body) : void 0
    }).then(function(r) {
      return r.json().then(function(d) {
        return { ok: r.ok, status: r.status, data: d };
      });
    });
  }
  function scanQR() {
    setErr("scan-error", "");
    var Scanner = getScanner();
    if (!Scanner) {
      setErr("scan-error", 'Scanner not available on this device. Please use "Enter bilty manually".');
      return;
    }
    Scanner.requestPermissions().then(function(p) {
      if (p && p.camera !== "granted" && p.camera !== "limited") {
        setErr("scan-error", "Camera permission is needed to scan. Allow it in Settings.");
        return;
      }
      function doScan() {
        return Scanner.scan({ formats: ["QR_CODE"] }).then(function(res) {
          var list = res && res.barcodes || [];
          if (!list.length) return;
          onScanned(list[0].rawValue || list[0].displayValue || "");
        });
      }
      var pre = Scanner.isGoogleBarcodeScannerModuleAvailable ? Scanner.isGoogleBarcodeScannerModuleAvailable().then(function(a) {
        if (a && a.available) return;
        return Scanner.installGoogleBarcodeScannerModule ? Scanner.installGoogleBarcodeScannerModule() : null;
      }).catch(function() {
      }) : Promise.resolve();
      return pre.then(doScan);
    }).catch(function(e) {
      setErr("scan-error", 'Could not open the scanner. Try "Enter bilty manually".');
    });
  }
  function onScanned(raw) {
    var id = "";
    try {
      var m = String(raw).match(/\/driver\/t\/([^/?#]+)/);
      if (m) id = m[1];
      else if (/^[0-9a-fA-F-]{10,}$/.test(raw)) id = raw;
    } catch (e) {
    }
    if (!id) {
      setErr("scan-error", "This QR is not a TransClick bilty.");
      return;
    }
    loadTrip(id);
  }
  function loadTrip(biltyId) {
    state.biltyId = biltyId;
    show("screen-loading");
    api("/api/driver/scan?b=" + encodeURIComponent(biltyId)).then(function(r) {
      if (!r.ok) {
        show("screen-scan");
        setErr("scan-error", r.data && r.data.error || "This bilty could not be opened.");
        return;
      }
      var t = r.data;
      $("c-bilty").textContent = t.bilty_number || "\u2014";
      $("c-vehicle").textContent = t.vehicle_number || "\u2014";
      $("c-to").textContent = t.unloading_point || t.to_state || "\u2014";
      $("c-consignee").textContent = t.consignee_name || "\u2014";
      $("d-name").value = t.driver_name || "";
      $("d-mobile").value = t.driver_mobile || "";
      state._manual = null;
      show("screen-confirm");
    }).catch(function() {
      show("screen-scan");
      setErr("scan-error", "Network error. Check your internet.");
    });
  }
  function manualGo() {
    var b = $("m-bilty").value.trim(), v = $("m-vehicle").value.trim();
    if (!b || !v) {
      setErr("scan-error", "Enter both bilty number and vehicle number.");
      return;
    }
    state.biltyId = null;
    state._manual = { bilty_number: b, vehicle_number: v };
    $("c-bilty").textContent = b;
    $("c-vehicle").textContent = v;
    $("c-to").textContent = "\u2014";
    $("c-consignee").textContent = "\u2014";
    show("screen-confirm");
  }
  function startTrip() {
    setErr("confirm-error", "");
    var name = $("d-name").value.trim(), mobile = $("d-mobile").value.trim();
    var body = { driver_name: name || null, driver_mobile: mobile || null };
    if (state.biltyId) body.bilty_id = state.biltyId;
    else if (state._manual) {
      body.bilty_number = state._manual.bilty_number;
      body.vehicle_number = state._manual.vehicle_number;
    }
    var btn = $("btn-start");
    btn.disabled = true;
    btn.textContent = "Starting\u2026";
    api("/api/driver/login", body).then(function(r) {
      btn.disabled = false;
      btn.textContent = "Start Live Tracking";
      if (!r.ok) {
        setErr("confirm-error", r.data && r.data.error || "Could not start. Please try again.");
        return;
      }
      state.sessionId = r.data.session_id;
      state.bilty = r.data.bilty;
      save();
      enterTracking();
      startWatcher();
    }).catch(function() {
      btn.disabled = false;
      btn.textContent = "Start Live Tracking";
      setErr("confirm-error", "Network error. Check your internet.");
    });
  }
  function enterTracking() {
    var b = state.bilty || {};
    $("t-bilty").textContent = b.bilty_number || "\u2014";
    $("t-vehicle").textContent = b.vehicle_number || "\u2014";
    $("t-last").textContent = "\u2014";
    $("await-close").classList.toggle("hidden", !state.awaitingClose);
    $("pod-zone").classList.toggle("hidden", state.awaitingClose);
    show("screen-track");
    startPoll();
  }
  function startWatcher() {
    var BG = getBG();
    if (!BG) {
      browserWatch();
      return;
    }
    if (state.watcherId) return;
    BG.addWatcher({
      backgroundMessage: "Trip location is being shared.",
      backgroundTitle: "TransClick Driver \u2014 tracking on",
      requestPermissions: true,
      stale: false,
      distanceFilter: 25
    }, function(location, error) {
      if (error) {
        if (error.code === "NOT_AUTHORIZED") {
          if (window.confirm('Location permission is off. Open settings to allow "Allow all the time"?')) {
            BG.openSettings && BG.openSettings();
          }
        }
        return;
      }
      if (location) postLocation(location.latitude, location.longitude, location.accuracy);
    }).then(function(id) {
      state.watcherId = id;
    });
  }
  function stopWatcher() {
    var BG = getBG();
    if (BG && state.watcherId) {
      try {
        BG.removeWatcher({ id: state.watcherId });
      } catch (e) {
      }
      state.watcherId = null;
    }
    if (state._bw) {
      clearInterval(state._bw);
      state._bw = null;
    }
    if (navigator.geolocation && state._wid != null) {
      navigator.geolocation.clearWatch(state._wid);
      state._wid = null;
    }
  }
  function browserWatch() {
    if (!navigator.geolocation) return;
    state._wid = navigator.geolocation.watchPosition(function(p) {
      postLocation(p.coords.latitude, p.coords.longitude, p.coords.accuracy);
    }, function() {
    }, { enableHighAccuracy: true, maximumAge: 1e4, timeout: 2e4 });
  }
  function postLocation(lat, lng, acc) {
    if (!state.sessionId) return;
    api("/api/driver/location", { session_id: state.sessionId, lat, lng, accuracy: acc || null }).then(function(r) {
      if (r.ok) {
        var d = /* @__PURE__ */ new Date();
        $("t-last").textContent = pad(d.getHours()) + ":" + pad(d.getMinutes());
      }
    }).catch(function() {
    });
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function startPoll() {
    stopPoll();
    state.pollTimer = setInterval(checkSession, 2e4);
    checkSession();
  }
  function stopPoll() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }
  function checkSession() {
    if (!state.sessionId) return;
    api("/api/driver/session?session_id=" + encodeURIComponent(state.sessionId)).then(function(r) {
      if (!r.ok) return;
      var d = r.data;
      if (d.pod_submitted) setAwaiting(true);
      if (d.is_active === false) tripClosed();
    }).catch(function() {
    });
  }
  function setAwaiting(v) {
    state.awaitingClose = v;
    $("await-close").classList.toggle("hidden", !v);
    $("pod-zone").classList.toggle("hidden", v);
  }
  function submitPOD() {
    if (!state.sessionId) return;
    if (!window.confirm("Mark this delivery complete? Tracking will continue until the admin closes it.")) return;
    var btn = $("btn-pod");
    btn.disabled = true;
    btn.textContent = "Submitting\u2026";
    api("/api/driver/pod", { session_id: state.sessionId }).then(function(r) {
      btn.disabled = false;
      btn.textContent = "Mark Delivery Complete (POD)";
      if (!r.ok) {
        window.alert(r.data && r.data.error || "POD failed. Try again.");
        return;
      }
      setAwaiting(true);
    }).catch(function() {
      btn.disabled = false;
      btn.textContent = "Mark Delivery Complete (POD)";
      window.alert("No internet. Try again.");
    });
  }
  function tripClosed() {
    stopWatcher();
    stopPoll();
    $("done-bilty").textContent = state.bilty && state.bilty.bilty_number || "";
    clearSaved();
    state.sessionId = null;
    state.bilty = null;
    state.awaitingClose = false;
    show("screen-done");
  }
  function resume() {
    var sid = null, bilty = null;
    try {
      sid = localStorage.getItem("tc_session");
      bilty = JSON.parse(localStorage.getItem("tc_bilty") || "null");
    } catch (e) {
    }
    if (!sid) {
      show("screen-scan");
      return;
    }
    state.sessionId = sid;
    state.bilty = bilty;
    api("/api/driver/session?session_id=" + encodeURIComponent(sid)).then(function(r) {
      if (r.ok && r.data && r.data.is_active !== false) {
        state.awaitingClose = !!r.data.pod_submitted;
        enterTracking();
        startWatcher();
      } else {
        clearSaved();
        state.sessionId = null;
        show("screen-scan");
      }
    }).catch(function() {
      enterTracking();
      startWatcher();
    });
  }
  document.addEventListener("DOMContentLoaded", function() {
    $("btn-scan").addEventListener("click", scanQR);
    $("btn-manual-toggle").addEventListener("click", function() {
      $("manual-box").classList.toggle("hidden");
    });
    $("btn-manual-go").addEventListener("click", manualGo);
    $("btn-start").addEventListener("click", startTrip);
    $("btn-confirm-back").addEventListener("click", function() {
      show("screen-scan");
    });
    $("btn-pod").addEventListener("click", submitPOD);
    $("btn-new").addEventListener("click", function() {
      show("screen-scan");
    });
    resume();
  });
})();
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
