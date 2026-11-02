// Composition du message envoyé : texte saisi, puis chaque document joint précédé de son nom lisible.
// Partagée par le processus principal (qui fait foi) et l'interface (aperçu).

export interface ComposeFile {
  readableName: string;
  text: string;
}

export function composeMessage(userText: string, files: ComposeFile[]): string {
  const parts = [userText.trim(), ...files.map((f) => `Document « ${f.readableName} » :\n${f.text}`)];
  return parts.filter((p) => p.length > 0).join('\n\n');
}
