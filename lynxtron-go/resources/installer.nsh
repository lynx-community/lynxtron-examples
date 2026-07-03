!macro registerLynxtronGoProtocol
  WriteRegStr SHELL_CONTEXT "Software\Classes\lynxtron" "" "URL:lynxtron"
  WriteRegStr SHELL_CONTEXT "Software\Classes\lynxtron" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\lynxtron\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\lynxtron\shell" "" "open"
  WriteRegStr SHELL_CONTEXT "Software\Classes\lynxtron\shell\open\command" "" "$\"$appExe$\" $\"%1$\""
!macroend

!macro unregisterLynxtronGoProtocol
  DeleteRegKey SHELL_CONTEXT "Software\Classes\lynxtron"
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
