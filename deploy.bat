@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "REMOTE_URL=https://github.com/Kenobi1105/personal-dashboard.git"
set "PUSH_HOST=github.com"
set "PUSH_REPO=Kenobi1105/personal-dashboard.git"
set "BRANCH_NAME=main"

echo.
echo Personal Dashboard deployment
echo =============================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git was not found on this computer.
  echo Install Git for Windows, then run this file again.
  goto fail
)

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo Initializing Git repository...
  git init
  if errorlevel 1 goto fail
)

git branch -M "%BRANCH_NAME%" >nul 2>nul

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo Connecting to GitHub remote...
  git remote add origin "%REMOTE_URL%"
) else (
  git remote set-url origin "%REMOTE_URL%"
)
if errorlevel 1 goto fail

echo.
echo Checking private files...
if exist ".secret\" (
  git check-ignore -q ".secret/"
  if errorlevel 1 (
    echo ERROR: .secret/ is not ignored by Git.
    goto fail
  )
)
if exist ".secrets\" (
  git check-ignore -q ".secrets/"
  if errorlevel 1 (
    echo ERROR: .secrets/ is not ignored by Git.
    goto fail
  )
)
if exist ".dashboard-private.json" (
  git check-ignore -q ".dashboard-private.json"
  if errorlevel 1 (
    echo ERROR: .dashboard-private.json is not ignored by Git.
    goto fail
  )
)
if exist ".google-calendar-token.json" (
  git check-ignore -q ".google-calendar-token.json"
  if errorlevel 1 (
    echo ERROR: .google-calendar-token.json is not ignored by Git.
    goto fail
  )
)

echo Staging safe files...
git add .
if errorlevel 1 goto fail

git diff --cached --name-only > "%TEMP%\dashboard-staged-files.txt"
findstr /I /C:".secret/" /C:".secrets/" /C:".dashboard-private.json" /C:".google-calendar-token.json" "%TEMP%\dashboard-staged-files.txt" >nul
if not errorlevel 1 (
  echo.
  echo ERROR: A private file was staged. Deployment stopped.
  echo Staged private paths:
  findstr /I /C:".secret/" /C:".secrets/" /C:".dashboard-private.json" /C:".google-calendar-token.json" "%TEMP%\dashboard-staged-files.txt"
  goto fail
)

git ls-files > "%TEMP%\dashboard-tracked-files.txt"
findstr /I /C:".secret/" /C:".secrets/" /C:".dashboard-private.json" /C:".google-calendar-token.json" "%TEMP%\dashboard-tracked-files.txt" >nul
if not errorlevel 1 (
  echo.
  echo ERROR: A private file is already tracked by Git. Deployment stopped.
  echo Tracked private paths:
  findstr /I /C:".secret/" /C:".secrets/" /C:".dashboard-private.json" /C:".google-calendar-token.json" "%TEMP%\dashboard-tracked-files.txt"
  echo Remove it from Git tracking before deploying.
  goto fail
)

git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo No new changes to commit. Pushing current branch anyway...
  call :push_with_token
  if errorlevel 1 goto fail
  goto done
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd-HHmmss"') do set "STAMP=%%i"

echo.
echo Creating commit...
git commit -m "Deploy dashboard %STAMP%"
if errorlevel 1 goto fail

echo.
echo Pushing to GitHub...
call :push_with_token
if errorlevel 1 goto fail

:done
echo.
echo Done. GitHub Pages can now build from the pushed branch.
echo Press any key to close.
pause >nul
exit /b 0

:push_with_token
echo.
echo GitHub authentication
echo ---------------------
set "GITHUB_USER="
set "GITHUB_TOKEN="
set /p "GITHUB_USER=GitHub username: "
if "%GITHUB_USER%"=="" (
  echo ERROR: GitHub username is required.
  exit /b 1
)
for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "$s=Read-Host 'GitHub token' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "GITHUB_TOKEN=%%t"
if "%GITHUB_TOKEN%"=="" (
  echo ERROR: GitHub token is required.
  exit /b 1
)
echo.
echo Pushing with the token you provided for this run only...
git remote set-url origin "%REMOTE_URL%" >nul 2>nul
git -c credential.helper= push -u "https://%GITHUB_USER%:%GITHUB_TOKEN%@%PUSH_HOST%/%PUSH_REPO%" "%BRANCH_NAME%:%BRANCH_NAME%"
set "PUSH_RESULT=%ERRORLEVEL%"
set "GITHUB_TOKEN="
if not "%PUSH_RESULT%"=="0" exit /b %PUSH_RESULT%
git remote set-url origin "%REMOTE_URL%" >nul 2>nul
exit /b 0

:fail
set "GITHUB_TOKEN="
echo.
echo Deployment stopped. Read the message above, then press any key to close.
pause >nul
exit /b 1
