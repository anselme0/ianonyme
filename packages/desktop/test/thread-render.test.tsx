import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssistantText, segmentsToMarkdown } from '../src/renderer/components/Thread.js';

const entities = [
  { id: 'E1', category: 'PERSONNE' as const, canonical: 'Jean Garnier', placeholder: '[PERSONNE_1]', variants: [] },
  { id: 'E2', category: 'EMAIL' as const, canonical: 'fictif@exemple.org', placeholder: '[EMAIL_1]', variants: [] },
];

describe('rendu des réponses restituées', () => {
  it('remplace les valeurs par des jetons inertes avant l\'analyse Markdown', () => {
    const { markdown, values } = segmentsToMarkdown([
      { text: 'Voir ' },
      { text: 'Jean Garnier', restoredFrom: 'E1' },
      { text: ' et ' },
      { text: 'fictif@exemple.org', restoredFrom: 'E2' },
    ]);
    expect(markdown).not.toContain('Garnier');
    expect(values).toHaveLength(2);
  });

  it('souligne les valeurs et affiche l\'info-bulle, y compris une adresse e-mail', () => {
    const html = renderToStaticMarkup(
      <AssistantText
        entities={entities}
        segments={[
          { text: '**Contact** : ' },
          { text: 'fictif@exemple.org', restoredFrom: 'E2' },
          { text: ' puis ' },
          { text: 'Jean Garnier', restoredFrom: 'E1' },
          { text: '.' },
        ]}
      />,
    );
    expect(html).toContain('<span class="restored" title="Remplace [EMAIL_1]" data-restored="E2">fictif@exemple.org</span>');
    expect(html).toContain('title="Remplace [PERSONNE_1]"');
    expect(html).toContain('<strong>Contact</strong>');
    expect(html).not.toMatch(/ZqRst|[-]/);
  });

  it('une valeur contenant du Markdown ne casse pas la mise en forme', () => {
    const html = renderToStaticMarkup(
      <AssistantText entities={entities} segments={[{ text: 'Nom : ' }, { text: '**Jean_Garnier**', restoredFrom: 'E1' }]} />,
    );
    expect(html).toContain('**Jean_Garnier**');
    expect(html).not.toContain('<strong>');
  });
});
