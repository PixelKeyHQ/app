Pod::Spec.new do |s|
  s.name           = 'WebCookies'
  s.version        = '1.0.0'
  s.summary        = 'Reads one cookie from the in-app login WebView and clears WebView data'
  s.description    = 'Reads one cookie from the in-app login WebView and clears WebView data'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,swift}"
end
