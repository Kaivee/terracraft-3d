@echo off
setlocal
cd /d "%~dp0"
if not exist build\classes\terracraft\Main.class (
  echo Classes not found - running build first...
  call build.bat
  if errorlevel 1 exit /b 1
)
echo Starting TerraCraft 3D server...
powershell -NoProfile -NoLogo -ExecutionPolicy Bypass -Command "& java -cp 'build/classes;lib/*' --enable-native-access=ALL-UNNAMED '-Djava.awt.headless=true' terracraft.Main"
endlocal
