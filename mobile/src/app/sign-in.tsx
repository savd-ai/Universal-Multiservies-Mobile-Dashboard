import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button, Card, Field, Headline, Screen } from "../components/ui";
import { ApiError } from "../lib/api";
import { useSession } from "../lib/session";
import { loadLastServer } from "../lib/storage";
import { fonts, usePalette } from "../lib/theme";

export default function SignInScreen() {
  const p = usePalette();
  const { signIn, completeMfa } = useSession();
  const [server, setServer] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadLastServer().then((last) => last && setServer(last));
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (challenge) await completeMfa({ server, challenge, code });
      else {
        const result = await signIn({ server, email, password });
        if (result.mfaChallenge) setChallenge(result.mfaChallenge);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={{ paddingTop: 24, gap: 6 }}>
          <Text style={{ fontSize: 28, fontWeight: "700", color: p.logoInk, letterSpacing: 0.6 }}>
            SAV<Text style={{ color: p.logoD }}>D</Text>
          </Text>
          <Text style={{ color: p.faint, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.6 }}>ADS INTELLIGENCE · MOBILE</Text>
        </View>
        <Headline eyebrow="Sign in" title={challenge ? "One more *step*" : "Your accounts, *anywhere*"} />
        <Card>
          {challenge ? (
            <Field label="Authenticator code" hint="6 digits from your authenticator app, or a recovery code." value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus />
          ) : (
            <>
              <Field label="Dashboard address" hint="The web address you use for the dashboard, e.g. https://ads.example.com" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" textContentType="URL" placeholder="https://" />
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="password" onSubmitEditing={() => void submit()} />
            </>
          )}
          {error ? <Text style={{ color: p.crit, lineHeight: 20 }}>{error}</Text> : null}
          <Button label={challenge ? "Verify and sign in" : "Sign in"} onPress={() => void submit()} loading={busy} disabled={challenge ? code.trim().length < 6 : !server.trim() || !email.trim() || !password} />
          {challenge ? (
            <Button
              label="Start over"
              variant="ghost"
              onPress={() => {
                setChallenge(null);
                setCode("");
              }}
            />
          ) : null}
        </Card>
        <Text style={{ color: p.faint, fontSize: 12, lineHeight: 18 }}>
          Same account as the web dashboard. The app only reads Google Ads; the session can be revoked from Account → Sessions on the web.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
