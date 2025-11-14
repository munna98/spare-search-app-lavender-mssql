; Custom NSIS installer script for Spare Parts Search
; This file should be placed in the build/installer.nsh

!macro customInit
  ; Close any running instances before installation
  ${IfNot} ${Silent}
    ; Check if application is running
    nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq Spare Parts Search.exe" | find /I /N "Spare Parts Search.exe"'
    Pop $0
    Pop $1
    
    ${If} $0 == 0
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
        "Spare Parts Search is currently running.$\n$\nPlease close it before continuing the installation.$\n$\nClick OK after closing the application, or Cancel to exit the installer." \
        /SD IDCANCEL IDOK tryAgain
      Quit
      
      tryAgain:
        Sleep 1000
        ; Check again
        nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq Spare Parts Search.exe" | find /I /N "Spare Parts Search.exe"'
        Pop $0
        Pop $1
        
        ${If} $0 == 0
          MessageBox MB_OK|MB_ICONSTOP "The application is still running. Please close it manually and try again."
          Quit
        ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  ; Additional custom installation steps can go here
!macroend

!macro customUnInstall
  ; Close the application if running during uninstall
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq Spare Parts Search.exe" | find /I /N "Spare Parts Search.exe"'
  Pop $0
  
  ${If} $0 == 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
      "Spare Parts Search is currently running.$\n$\nPlease close it before continuing the uninstallation." \
      IDOK +2
    Quit
    Sleep 2000
  ${EndIf}
!macroend