@echo off
echo Setting up MouseMinimizer to launch automatically on Windows Startup...
set SCRIPT_DIR=%~dp0
set TARGET_EXE=%SCRIPT_DIR%dist\MouseMinimizer\MouseMinimizer.exe
set SHORTCUT_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MouseMinimizer.lnk

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_EXE%'; $s.WorkingDirectory = '%SCRIPT_DIR%dist\MouseMinimizer'; $s.Save()"

echo Done! MouseMinimizer will now run automatically when Windows starts.
pause
