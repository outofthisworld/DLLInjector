const fs = require("fs");
const { spawn } = require("child_process");
const { remote } = require("electron");
const obfuscator = require("javascript-obfuscator");
const { ConfuserEx } = require("confuserex");
const { AES, sha256 } = require("crypto-js");
const ffi = require("node-ffi");
const argv = require("yargs").argv;
const logger = require("winston");

// This is the process that will be injected with the DLL.
const processName = argv.process || "mygame.exe";

const obfuscate = (data) => {
  return obfuscator
    .obfuscate(data, {
      compact: true,
      controlFlowFlattening: true,
      deadCodeInjection: true,
      debugProtection: false,
      selfDefending: true,
      stringArray: true,
      stringArrayEncoding: true,
      stringArrayThreshold: 0.75,
      unicodeEscapeSequence: false
    })
    .getObfuscatedCode();
};

const encryptDll = (dllBuffer, secret, salt) => {
  // Obfuscate the DLL code using ConfuserEx
  const obfuscatedDll = ConfuserEx.obfuscate(dllBuffer);

  // Use JavaScript Obfuscator to further obfuscate the DLL code
  const doubleObfuscatedDll = obfuscate(obfuscatedDll);

  // Generate a key for encrypting the DLL using the secret and the salt
  const key = sha256(secret + salt);

  // Encrypt the double-obfuscated DLL code using AES
  const encryptedDll = AES.encrypt(doubleObfuscatedDll, key).toString();

  // Return the encrypted DLL code
  return encryptedDll;
};

const decryptDll = (encryptedDll, secret, salt) => {
  // Generate a key for decrypting the DLL using the secret and the salt
  const key = sha256(secret + salt);

  // Decrypt the DLL code using AES
  const decryptedDll = AES.decrypt(encryptedDll, key);

  // Return the decrypted DLL code as a buffer
  return new Buffer.from(decryptedDll.toString(), "base64");
};

const injectDll = async (processId, dllPath, secret) => {
  try {
    const dllBuffer = fs.readFileSync(dllPath);

    // Generate a random salt to use when encrypting the DLL
    const salt = Math.random().toString(36).substring(2);

    // Encrypt the DLL using the secret and the salt
    const encryptedDll = encryptDll(dllBuffer, secret, salt + processId);

    // Use Electron's remote module to inject the encrypted DLL code into the game process
    const injected = await remote.inject(processId, encryptedDll);

    const decryptedDll = decryptDll(injected.data, secret, salt + processId);

    // If injection was successful, create a new instance of the ffi library for calling methods in the DLL
    if (injected) {
      const library = ffi.Library(decryptedDll, {
        my_function: ["void", ["string"]]
      });

      // Return the library instance, so that it can be used to call methods in the DLL
      return library;
    }

    // If injection failed, throw an error
    throw new Error("Failed to inject DLL");
  } catch (error) {
    logger.error(error.message);
  }
};

const startGame = async () => {
  // Start the game process.
  const gameProcess = spawn(processName);

  // Wait for the game process to start.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Read the list of DLLs to inject from the command-line arguments
  const dllPaths = argv.dlls || [];

  // Validate and sanitize the user-defined secret key
  const secret =
    typeof argv.secret === "string" && argv.secret.length > 0
      ? argv.secret
      : Math.random().toString(36).substring(2);

  // Inject each DLL into the game process and get a reference to the library instances
  const libraries = await Promise.all(
    dllPaths.map((dllPath) => injectDll(gameProcess.pid, dllPath, secret))
  );

  // Call a method in each injected DLL using the corresponding library instance
  libraries.forEach((library) => library.my_function("hello world"));

  // Monitor the game process for crashes and exits, and restart it if necessary
  gameProcess.on("exit", () => {
    logger.info("Game process exited, restarting...");
    startGame();
  });

  gameProcess.on("error", (error) => {
    logger.error(`Game process error: ${error.message}`);
    startGame();
  });
};

// Start the game and inject the DLLs.
startGame();
