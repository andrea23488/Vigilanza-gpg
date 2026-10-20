Pod::Spec.new do |s|
  s.name = 'TurniDocumentiIOS'
  s.version = '1.0.0'
  s.summary = 'Lettura locale di PDF testuali e immagini dei turni'
  s.description = s.summary
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Vigilanza GPG'
  s.homepage = 'https://github.com/andrea23488/Vigilanza-gpg'
  s.source = { :git => 'https://github.com/andrea23488/Vigilanza-gpg.git' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PDFKit', 'Vision', 'ImageIO'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
