@echo off
setlocal
cd /d "%~dp0"
echo Compiling and running Java tests...
powershell -NoProfile -NoLogo -ExecutionPolicy Bypass -Command "New-Item -ItemType Directory -Force -Path build/classes,build/test-classes | Out-Null; $main = Get-ChildItem -Recurse -Filter *.java -Path src | ForEach-Object FullName; & javac -encoding UTF-8 -cp 'lib/*' -d build/classes $main; if ($LASTEXITCODE -ne 0) { exit 1 }; $tests = Get-ChildItem -Recurse -Filter *.java -Path test | ForEach-Object FullName; & javac -encoding UTF-8 -cp 'build/classes;lib/*' -d build/test-classes $tests; if ($LASTEXITCODE -ne 0) { exit 1 }; & java -cp 'build/classes;build/test-classes;lib/*' --enable-native-access=ALL-UNNAMED '-Djava.awt.headless=true' org.junit.platform.console.ConsoleLauncher --scan-classpath; exit $LASTEXITCODE"
if errorlevel 1 (
  echo.
  echo Tests failed.
  exit /b 1
)
echo.
echo All tests passed.
endlocal
