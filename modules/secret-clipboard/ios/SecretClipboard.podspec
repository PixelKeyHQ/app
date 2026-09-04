Pod::Spec.new do |s|
  s.name           = 'SecretClipboard'
  s.version        = '1.0.0'
  s.summary        = 'Copies secret text without Universal Clipboard sync'
  s.description    = 'Copies secret text without Universal Clipboard sync'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,swift}"
end
