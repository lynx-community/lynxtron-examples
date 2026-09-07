!macro registerLynxtronGoProtocol
  WriteRegStr SHELL_CONTEXT "Software\Classes\lynxtron-go" "" "URL:lynxtron-go"
  WriteRegStr SHELL_CONTEXT "Software\Classes\lynxtron-go" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\lynxtron-go\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\lynxtron-go\shell" "" "open"
  WriteRegStr SHELL_CONTEXT "Software\Classes\lynxtron-go\shell\open\command" "" "$\"$appExe$\" $\"%1$\""
!macroend

!macro unregisterLynxtronGoProtocol
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\lynxtron-go\shell\open\command" ""
  StrCpy $1 "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
  ${If} $0 == $1
    DeleteRegKey SHELL_CONTEXT "Software\Classes\lynxtron-go"
  ${EndIf}
!macroend

!macro notifyShellAssociationChanged
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend

!macro customInstall
  !insertmacro registerLynxtronGoProtocol
  !insertmacro notifyShellAssociationChanged
!macroend

!macro customUnInstall
  !insertmacro unregisterLynxtronGoProtocol
  !insertmacro notifyShellAssociationChanged
!macroend
