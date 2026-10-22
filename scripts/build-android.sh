#!/usr/bin/env bash
# Packages the production SvelteKit frontend into a signed Android APK.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$ROOT/android"
WWW="$ANDROID/app/src/main/assets/www"
export ANDROID_HOME="${ANDROID_HOME:-/usr/lib/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"

printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$ANDROID/local.properties"

echo "Building SvelteKit client…"
(cd "$ROOT" && bun run build)

rm -rf "$WWW"
mkdir -p "$WWW"
# Full compiled frontend: JS, CSS, fonts, brand, intro video.
rsync -a --exclude '*.br' --exclude '*.gz' "$ROOT/build/client/" "$WWW/"
echo "Bundled frontend: $(du -sh "$WWW" | awk '{print $1}')"

if [[ ! -f "$ANDROID/uci.keystore" ]]; then
	PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
	keytool -genkeypair -v \
		-keystore "$ANDROID/uci.keystore" \
		-alias uci \
		-keyalg RSA -keysize 2048 -validity 10000 \
		-storepass "$PASS" -keypass "$PASS" \
		-dname 'CN=UCI, OU=Upendra Competition Institute, O=UCI, L=India, ST=MP, C=IN'
	cat > "$ANDROID/keystore.properties" <<EOF
storeFile=uci.keystore
storePassword=$PASS
keyAlias=uci
keyPassword=$PASS
EOF
	SHA_COLONS="$(keytool -list -v -keystore "$ANDROID/uci.keystore" -storepass "$PASS" -alias uci \
		| awk -F': ' '/SHA256:/{print $2; exit}')"
	mkdir -p "$ROOT/static/.well-known"
	cat > "$ROOT/static/.well-known/assetlinks.json" <<EOF
[
	{
		"relation": ["delegate_permission/common.handle_all_urls"],
		"target": {
			"namespace": "android_app",
			"package_name": "com.uci.examprep",
			"sha256_cert_fingerprints": ["${SHA_COLONS}"]
		}
	}
]
EOF
fi

GRADLE="${GRADLE:-}"
if [[ -z "$GRADLE" ]]; then
	if [[ -x "$ANDROID/gradlew" ]]; then
		GRADLE="$ANDROID/gradlew"
	else
		GRADLE="$(find "$HOME/.gradle/wrapper/dists" -path '*gradle-9.2.0/bin/gradle' -type f | head -n1)"
	fi
fi
if [[ -z "$GRADLE" || ! -x "$GRADLE" ]]; then
	echo "Gradle not found" >&2
	exit 1
fi

(cd "$ANDROID" && "$GRADLE" assembleRelease --no-daemon)

APK="$(find "$ANDROID/app/build/outputs/apk/release" -name '*.apk' | head -n1)"
if [[ -z "$APK" ]]; then
	echo "APK not produced" >&2
	exit 1
fi
cp -f "$APK" "$ANDROID/uci.apk"
echo "APK: $ANDROID/uci.apk"
ls -lh "$ANDROID/uci.apk"
