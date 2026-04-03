@echo off
cd /d "C:\Users\makaluspo\app ro%C3%A7a"
echo PORT=%PORT% > "%TEMP%\expo-preview-debug.txt"
echo PATH=%PATH% >> "%TEMP%\expo-preview-debug.txt"
where npx >> "%TEMP%\expo-preview-debug.txt" 2>&1
npx expo start --web --port %PORT% >> "%TEMP%\expo-preview-debug.txt" 2>&1
