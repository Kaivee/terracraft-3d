@echo off
setlocal
cd /d "%~dp0"
echo Building TerraCraft 3D (Java backend)...
powershell -NoProfile -NoLogo -ExecutionPolicy Bypass -Command "New-Item -ItemType Directory -Force -Path build/classes | Out-Null; $files = Get-ChildItem -Recurse -Filter *.java -Path src | ForEach-Object FullName; & javac -encoding UTF-8 -cp 'lib/*' -d build/classes $files; exit $LASTEXITCODE"
if errorlevel 1 (
  echo.
  echo Build failed.
  exit /b 1
)
echo Build succeeded. Classes in build\classes
endlocal
