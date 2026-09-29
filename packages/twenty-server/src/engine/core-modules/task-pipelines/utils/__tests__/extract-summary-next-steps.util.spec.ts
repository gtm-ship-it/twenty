import { extractSummaryNextSteps } from 'src/engine/core-modules/task-pipelines/utils/extract-summary-next-steps.util';

const SHARE = 'https://fathom.video/share/abc';

describe('extractSummaryNextSteps', () => {
  it('returns null when there is no next steps section', () => {
    expect(
      extractSummaryNextSteps('## Puntos clave\n\n- [**A:** b](https://x.y)'),
    ).toBeNull();
    expect(extractSummaryNextSteps(null)).toBeNull();
  });

  it('reads linked bullets of a Spanish summary with timestamps', () => {
    const markdown = [
      '## Puntos clave',
      '',
      `  - [**Desbloquear:** no es un paso](${SHARE}?tab=summary&timestamp=10.0)`,
      '',
      '## Próximos pasos',
      '',
      `  - [**Mauro:** Pedir a Alex \\~25 leads de D-Ladder.](${SHARE}?tab=summary&timestamp=1884.0)`,
      `  - [Yeison enviará el reporte](${SHARE}?tab=summary&timestamp=3725)`,
      '',
      '## Temas',
      '',
      `  - [Otro tema](${SHARE}?timestamp=5)`,
    ].join('\n');

    expect(extractSummaryNextSteps(markdown)).toEqual({
      language: 'es',
      items: [
        expect.objectContaining({
          description: 'Mauro: Pedir a Alex ~25 leads de D-Ladder.',
          recording_timestamp: '00:31:24',
          recording_playback_url: `${SHARE}?tab=summary&timestamp=1884.0`,
          assignee: null,
        }),
        expect.objectContaining({
          description: 'Yeison enviará el reporte',
          recording_timestamp: '01:02:05',
        }),
      ],
    });
  });

  it('prefixes nested bullets with their group header', () => {
    const markdown = [
      '## Next Steps',
      '',
      '- **Mateo Valencia**',
      `  - [Set up the sender account](${SHARE}?timestamp=60)`,
      `  - [Send the brand book](${SHARE}?timestamp=120)`,
      '- **Mauro**',
      '  - Ask Alex for leads',
      '- Everyone reviews the CRM',
    ].join('\n');

    const result = extractSummaryNextSteps(markdown);

    expect(result?.language).toBe('en');
    expect(result?.items.map((item) => item.description)).toEqual([
      'Mateo Valencia: Set up the sender account',
      'Mateo Valencia: Send the brand book',
      'Mauro: Ask Alex for leads',
      'Everyone reviews the CRM',
    ]);
    expect(result?.items[2].recording_timestamp).toBeNull();
  });

  it('stops at a heading of the same level', () => {
    const markdown =
      '### Próximos pasos\n- Uno\n#### Sub\n- Dos\n### Temas\n- Tres';

    expect(
      extractSummaryNextSteps(markdown)?.items.map((i) => i.description),
    ).toEqual(['Uno', 'Dos']);
  });
});
