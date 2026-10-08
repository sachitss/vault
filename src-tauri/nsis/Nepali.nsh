;Language: Nepali (Devanagari script) (1121)
;Nepali translation for Valuables Vault

!insertmacro LANGFILE "Nepali" = "नेपाली" "Nepali"

!ifdef MUI_WELCOMEPAGE
  ${LangFileString} MUI_TEXT_WELCOME_INFO_TITLE "$(^NameDA) सेटअपमा स्वागत छ"
  ${LangFileString} MUI_TEXT_WELCOME_INFO_TEXT "सेटअपले तपाईंलाई $(^NameDA) को इन्स्टलेसन प्रक्रियामा मार्गदर्शन गर्नेछ।$\r$\n$\r$\nसेटअप सुरु गर्नुअघि अन्य सबै एप्लिकेसनहरू बन्द गर्न सिफारिस गरिन्छ। यसले तपाईंको कम्प्युटर रिबुट नगरिकनै सम्बन्धित सिस्टम फाइलहरू अपडेट गर्न सम्भव बनाउँछ।$\r$\n$\r$\n$_CLICK"
!endif

!ifdef MUI_UNWELCOMEPAGE
  ${LangFileString} MUI_UNTEXT_WELCOME_INFO_TITLE "$(^NameDA) अनइन्स्टलमा स्वागत छ"
  ${LangFileString} MUI_UNTEXT_WELCOME_INFO_TEXT "सेटअपले तपाईंलाई $(^NameDA) को अनइन्स्टलेसन प्रक्रियामा मार्गदर्शन गर्नेछ।$\r$\n$\r$\nअनइन्स्टलेसन सुरु गर्नुअघि $(^NameDA) चलिरहेको छैन भनी सुनिश्चित गर्नुहोस्।$\r$\n$\r$\n$_CLICK"
!endif

!ifdef MUI_LICENSEPAGE
  ${LangFileString} MUI_TEXT_LICENSE_TITLE "लाइसेन्स सम्झौता"
  ${LangFileString} MUI_TEXT_LICENSE_SUBTITLE "$(^NameDA) इन्स्टल गर्नुअघि कृपया लाइसेन्सका सर्तहरू पढ्नुहोस्।"
  ${LangFileString} MUI_INNERTEXT_LICENSE_BOTTOM "यदि तपाईं सम्झौताका सर्तहरू स्वीकार गर्नुहुन्छ भने जारी राख्न म सहमत छु बटनमा क्लिक गर्नुहोस्। $(^NameDA) इन्स्टल गर्न तपाईंले सम्झौता स्वीकार गर्नैपर्छ।"
  ${LangFileString} MUI_INNERTEXT_LICENSE_BOTTOM_CHECKBOX "यदि तपाईं सम्झौताका सर्तहरू स्वीकार गर्नुहुन्छ भने तलको चेक बक्समा क्लिक गर्नुहोस्। $(^NameDA) इन्स्टल गर्न तपाईंले सम्झौता स्वीकार गर्नैपर्छ। $_CLICK"
  ${LangFileString} MUI_INNERTEXT_LICENSE_BOTTOM_RADIOBUTTONS "यदि तपाईं सम्झौताका सर्तहरू स्वीकार गर्नुहुन्छ भने तलको पहिलो विकल्प छान्नुहोस्। $(^NameDA) इन्स्टल गर्न तपाईंले सम्झौता स्वीकार गर्नैपर्छ। $_CLICK"
!endif

!ifdef MUI_UNLICENSEPAGE
  ${LangFileString} MUI_UNTEXT_LICENSE_TITLE "लाइसेन्स सम्झौता"
  ${LangFileString} MUI_UNTEXT_LICENSE_SUBTITLE "$(^NameDA) अनइन्स्टल गर्नुअघि कृपया लाइसेन्सका सर्तहरू पढ्नुहोस्।"
  ${LangFileString} MUI_UNINNERTEXT_LICENSE_BOTTOM "यदि तपाईं सम्झौताका सर्तहरू स्वीकार गर्नुहुन्छ भने जारी राख्न म सहमत छु बटनमा क्लिक गर्नुहोस्। $(^NameDA) अनइन्स्टल गर्न तपाईंले सम्झौता स्वीकार गर्नैपर्छ।"
  ${LangFileString} MUI_UNINNERTEXT_LICENSE_BOTTOM_CHECKBOX "यदि तपाईं सम्झौताका सर्तहरू स्वीकार गर्नुहुन्छ भने तलको चेक बक्समा क्लिक गर्नुहोस्। $(^NameDA) अनइन्स्टल गर्न तपाईंले सम्झौता स्वीकार गर्नैपर्छ। $_CLICK"
  ${LangFileString} MUI_UNINNERTEXT_LICENSE_BOTTOM_RADIOBUTTONS "यदि तपाईं सम्झौताका सर्तहरू स्वीकार गर्नुहुन्छ भने तलको पहिलो विकल्प छान्नुहोस्। $(^NameDA) अनइन्स्टल गर्न तपाईंले सम्झौता स्वीकार गर्नैपर्छ। $_CLICK"
!endif

!ifdef MUI_LICENSEPAGE | MUI_UNLICENSEPAGE
  ${LangFileString} MUI_INNERTEXT_LICENSE_TOP "सम्झौताको बाँकी भाग हेर्न Page Down थिच्नुहोस्।"
!endif

!ifdef MUI_COMPONENTSPAGE
  ${LangFileString} MUI_TEXT_COMPONENTS_TITLE "कम्पोनेन्टहरू छान्नुहोस्"
  ${LangFileString} MUI_TEXT_COMPONENTS_SUBTITLE "$(^NameDA) का कुन-कुन सुविधाहरू इन्स्टल गर्न चाहनुहुन्छ, छान्नुहोस्।"
!endif

!ifdef MUI_UNCOMPONENTSPAGE
  ${LangFileString} MUI_UNTEXT_COMPONENTS_TITLE "कम्पोनेन्टहरू छान्नुहोस्"
  ${LangFileString} MUI_UNTEXT_COMPONENTS_SUBTITLE "$(^NameDA) का कुन-कुन सुविधाहरू अनइन्स्टल गर्न चाहनुहुन्छ, छान्नुहोस्।"
!endif

!ifdef MUI_COMPONENTSPAGE | MUI_UNCOMPONENTSPAGE
  ${LangFileString} MUI_INNERTEXT_COMPONENTS_DESCRIPTION_TITLE "विवरण"
  !ifndef NSIS_CONFIG_COMPONENTPAGE_ALTERNATIVE
    ${LangFileString} MUI_INNERTEXT_COMPONENTS_DESCRIPTION_INFO "कुनै कम्पोनेन्टको विवरण हेर्न माउसलाई त्यसमाथि राख्नुहोस्।"
  !else
    ${LangFileString} MUI_INNERTEXT_COMPONENTS_DESCRIPTION_INFO "कुनै कम्पोनेन्टको विवरण हेर्न त्यसलाई छान्नुहोस्।"
  !endif
!endif

!ifdef MUI_DIRECTORYPAGE
  ${LangFileString} MUI_TEXT_DIRECTORY_TITLE "इन्स्टल गर्ने स्थान छान्नुहोस्"
  ${LangFileString} MUI_TEXT_DIRECTORY_SUBTITLE "$(^NameDA) इन्स्टल गर्ने फोल्डर छान्नुहोस्।"
!endif

!ifdef MUI_UNDIRECTORYPAGE
  ${LangFileString} MUI_UNTEXT_DIRECTORY_TITLE "अनइन्स्टल गर्ने स्थान छान्नुहोस्"
  ${LangFileString} MUI_UNTEXT_DIRECTORY_SUBTITLE "$(^NameDA) अनइन्स्टल गर्ने फोल्डर छान्नुहोस्।"
!endif

!ifdef MUI_INSTFILESPAGE
  ${LangFileString} MUI_TEXT_INSTALLING_TITLE "इन्स्टल हुँदैछ"
  ${LangFileString} MUI_TEXT_INSTALLING_SUBTITLE "$(^NameDA) इन्स्टल हुँदै गर्दा कृपया पर्खनुहोस्।"
  ${LangFileString} MUI_TEXT_FINISH_TITLE "इन्स्टलेसन सम्पन्न भयो"
  ${LangFileString} MUI_TEXT_FINISH_SUBTITLE "सेटअप सफलतापूर्वक सम्पन्न भयो।"
  ${LangFileString} MUI_TEXT_ABORT_TITLE "इन्स्टलेसन रद्द गरियो"
  ${LangFileString} MUI_TEXT_ABORT_SUBTITLE "सेटअप सफलतापूर्वक सम्पन्न हुन सकेन।"
!endif

!ifdef MUI_UNINSTFILESPAGE
  ${LangFileString} MUI_UNTEXT_UNINSTALLING_TITLE "अनइन्स्टल हुँदैछ"
  ${LangFileString} MUI_UNTEXT_UNINSTALLING_SUBTITLE "$(^NameDA) अनइन्स्टल हुँदै गर्दा कृपया पर्खनुहोस्।"
  ${LangFileString} MUI_UNTEXT_FINISH_TITLE "अनइन्स्टलेसन सम्पन्न भयो"
  ${LangFileString} MUI_UNTEXT_FINISH_SUBTITLE "अनइन्स्टल सफलतापूर्वक सम्पन्न भयो।"
  ${LangFileString} MUI_UNTEXT_ABORT_TITLE "अनइन्स्टलेसन रद्द गरियो"
  ${LangFileString} MUI_UNTEXT_ABORT_SUBTITLE "अनइन्स्टल सफलतापूर्वक सम्पन्न हुन सकेन।"
!endif

!ifdef MUI_FINISHPAGE
  ${LangFileString} MUI_TEXT_FINISH_INFO_TITLE "$(^NameDA) सेटअप सम्पन्न गर्दै"
  ${LangFileString} MUI_TEXT_FINISH_INFO_TEXT "$(^NameDA) तपाईंको कम्प्युटरमा इन्स्टल भएको छ।$\r$\n$\r$\nसेटअप बन्द गर्न समाप्त बटनमा क्लिक गर्नुहोस्।"
  ${LangFileString} MUI_TEXT_FINISH_INFO_REBOOT "$(^NameDA) को इन्स्टलेसन सम्पन्न गर्न तपाईंको कम्प्युटर पुनः सुरु गर्नुपर्छ। के तपाईं अहिले रिबुट गर्न चाहनुहुन्छ?"
!endif

!ifdef MUI_UNFINISHPAGE
  ${LangFileString} MUI_UNTEXT_FINISH_INFO_TITLE "$(^NameDA) अनइन्स्टल सम्पन्न गर्दै"
  ${LangFileString} MUI_UNTEXT_FINISH_INFO_TEXT "$(^NameDA) तपाईंको कम्प्युटरबाट अनइन्स्टल भएको छ।$\r$\n$\r$\nसेटअप बन्द गर्न समाप्त बटनमा क्लिक गर्नुहोस्।"
  ${LangFileString} MUI_UNTEXT_FINISH_INFO_REBOOT "$(^NameDA) को अनइन्स्टलेसन सम्पन्न गर्न तपाईंको कम्प्युटर पुनः सुरु गर्नुपर्छ। के तपाईं अहिले रिबुट गर्न चाहनुहुन्छ?"
!endif

!ifdef MUI_FINISHPAGE | MUI_UNFINISHPAGE
  ${LangFileString} MUI_TEXT_FINISH_REBOOTNOW "अहिले रिबुट गर्नुहोस्"
  ${LangFileString} MUI_TEXT_FINISH_REBOOTLATER "म पछि आफैं रिबुट गर्न चाहन्छु"
  ${LangFileString} MUI_TEXT_FINISH_RUN "$(^NameDA) &चलाउनुहोस्"
  ${LangFileString} MUI_TEXT_FINISH_SHOWREADME "Readme &देखाउनुहोस्"
  ${LangFileString} MUI_BUTTONTEXT_FINISH "&समाप्त"
!endif

!ifdef MUI_STARTMENUPAGE
  ${LangFileString} MUI_TEXT_STARTMENU_TITLE "स्टार्ट मेनु फोल्डर छान्नुहोस्"
  ${LangFileString} MUI_TEXT_STARTMENU_SUBTITLE "$(^NameDA) का सर्टकटहरूका लागि स्टार्ट मेनु फोल्डर छान्नुहोस्।"
  ${LangFileString} MUI_INNERTEXT_STARTMENU_TOP "प्रोग्रामका सर्टकटहरू बनाउन चाहनुभएको स्टार्ट मेनु फोल्डर छान्नुहोस्। नयाँ फोल्डर बनाउन तपाईं नाम पनि लेख्न सक्नुहुन्छ।"
  ${LangFileString} MUI_INNERTEXT_STARTMENU_CHECKBOX "सर्टकटहरू नबनाउनुहोस्"
!endif

!ifdef MUI_UNCONFIRMPAGE
  ${LangFileString} MUI_UNTEXT_CONFIRM_TITLE "$(^NameDA) अनइन्स्टल गर्नुहोस्"
  ${LangFileString} MUI_UNTEXT_CONFIRM_SUBTITLE "तपाईंको कम्प्युटरबाट $(^NameDA) हटाउनुहोस्।"
!endif

!ifdef MUI_ABORTWARNING
  ${LangFileString} MUI_TEXT_ABORTWARNING "के तपाईं साँच्चै $(^Name) सेटअपबाट बाहिरिन चाहनुहुन्छ?"
!endif

!ifdef MUI_UNABORTWARNING
  ${LangFileString} MUI_UNTEXT_ABORTWARNING "के तपाईं साँच्चै $(^Name) अनइन्स्टलबाट बाहिरिन चाहनुहुन्छ?"
!endif

!ifdef MULTIUSER_INSTALLMODEPAGE
  ${LangFileString} MULTIUSER_TEXT_INSTALLMODE_TITLE "प्रयोगकर्ता छान्नुहोस्"
  ${LangFileString} MULTIUSER_TEXT_INSTALLMODE_SUBTITLE "$(^NameDA) कुन-कुन प्रयोगकर्ताका लागि इन्स्टल गर्न चाहनुहुन्छ, छान्नुहोस्।"
  ${LangFileString} MULTIUSER_INNERTEXT_INSTALLMODE_TOP "$(^NameDA) केवल आफ्नै लागि इन्स्टल गर्न चाहनुहुन्छ वा यस कम्प्युटरका सबै प्रयोगकर्ताका लागि, छान्नुहोस्। $(^ClickNext)"
  ${LangFileString} MULTIUSER_INNERTEXT_INSTALLMODE_ALLUSERS "यो कम्प्युटर प्रयोग गर्ने सबैका लागि इन्स्टल गर्नुहोस्"
  ${LangFileString} MULTIUSER_INNERTEXT_INSTALLMODE_CURRENTUSER "मेरो लागि मात्र इन्स्टल गर्नुहोस्"
!endif
