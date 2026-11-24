Pod::Spec.new do |s|
  s.name           = 'AnnouncementNotifications'
  s.version        = '1.0.0'
  s.summary        = 'The notice of a week’s announcements, made on the iPhone'
  s.description    = 'A local notification for the bulletin’s announcements (#709), at the time the app sets, and a tap that opens the bulletin.'
  s.author         = ''
  s.homepage       = 'https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
