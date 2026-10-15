/**
 * Adopt the UIScene life cycle (required on iOS 27: apps built with its SDK are terminated at launch without
 * it). Expo SDK 57 ships `ExpoAppSceneDelegate`, but the prebuild template still starts React Native from the
 * app delegate, so this plugin:
 *  1. makes AppDelegate an `ExpoReactNativeFactoryProvider` and stops it creating the window itself;
 *  2. declares a scene manifest whose delegate is Expo's scene delegate (`EXExpoAppSceneDelegate`).
 * Remove once the Expo template adopts scenes by default.
 */
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const START_IN_APP_DELEGATE =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

function withSceneLifecycle(config) {
  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift")
      throw new Error("with-scene-lifecycle expects a Swift AppDelegate");
    let src = cfg.modResults.contents;
    if (!src.includes("ExpoReactNativeFactoryProvider")) {
      src = src.replace(
        "class AppDelegate: ExpoAppDelegate {",
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {",
      );
    }
    if (START_IN_APP_DELEGATE.test(src)) {
      src = src.replace(
        START_IN_APP_DELEGATE,
        "\n    // React Native is started by ExpoAppSceneDelegate (scene life cycle; see plugins/with-scene-lifecycle.js).\n",
      );
    } else if (src.includes("factory.startReactNative(")) {
      throw new Error("with-scene-lifecycle: AppDelegate template changed; update the plugin's pattern");
    }
    cfg.modResults.contents = src;
    return cfg;
  });

  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "EXExpoAppSceneDelegate",
          },
        ],
      },
    };
    return cfg;
  });
}

module.exports = withSceneLifecycle;
