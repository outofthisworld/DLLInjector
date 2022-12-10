public class Dll{
[DllImport("kernel32.dll", SetLastError = true)]
public static extern IntPtr LoadLibrary(string lpFileName);

[DllImport("kernel32.dll", SetLastError = true)]
public static extern IntPtr GetModuleHandle(string lpModuleName);

[DllImport("kernel32.dll", SetLastError = true)]
public static extern IntPtr GetCurrentProcess();

[DllImport("kernel32.dll", SetLastError = true)]
public static extern IntPtr OpenProcess(int dwDesiredAccess, bool bInheritHandle, int dwProcessId);

[DllImport("kernel32.dll", SetLastError = true)]
public static extern IntPtr GetProcAddress(IntPtr hModule, string lpProcName);

[DllImport("user32.dll", SetLastError = true)]
public static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);

[DllImport("user32.dll", SetLastError = true)]
public static extern bool UnhookWindowsHookEx(IntPtr hhk);

[DllImport("kernel32.dll", SetLastError = true)]
public static extern bool WriteProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int nSize, out IntPtr lpNumberOfBytesWritten);

[DllImport("user32.dll", SetLastError = true)]
public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

public static delegate IntPtr HookCallbackFunc(int nCode, IntPtr wParam, IntPtr lParam);


public static void HookAndDetourFunction(string lpProcName, HookProc hookCallback)
{
    // Use GetCurrentProcess to get a handle to the current process
    IntPtr hProcess = GetCurrentProcess();

    // Use GetModuleHandle to get a handle to the current module
    IntPtr hModule = GetModuleHandle(null);

    // Use GetProcAddress to lookup the memory address of the original function
    IntPtr lpProcAddress = GetProcAddress(hModule, lpProcName);

    // Convert the hook callback method into a memory address using the Marshal.GetFunctionPointerForDelegate method
    IntPtr lpReplacementProcAddress = Marshal.GetFunctionPointerForDelegate(hookCallback);

    // Hook the original function using the SetWindowsHookEx function and the specified hook callback method
    SetWindowsHookEx(13, hookCallback, lpProcAddress, 0);

    // Write the memory address of the replacement function to the memory address of the original function
    WriteProcessMemory(hProcess, lpProcAddress, BitConverter.GetBytes(lpReplacementProcAddress), 4, out IntPtr bytesWritten);
}

  public static IntPtr MyHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
  {
      // Do something custom here...
  // Call the original function using the "CallNextHookEx" method
        CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
      // Return a dummy value
      return IntPtr.Zero;
  }

  [DllExport("DllMain", CallingConvention = CallingConvention.Cdecl)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool DllMain(IntPtr hinstDLL, uint fdwReason, IntPtr lpvReserved){
    HookAndDetourFunction("old", "new", MyHookCallback)
  }
}