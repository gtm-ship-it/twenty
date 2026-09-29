import {
  buildActionPointsUserPrompt,
  cardsFromActionItems,
  normalizeLlmCards,
  playbackUrlAt,
} from 'src/engine/core-modules/task-pipelines/utils/build-action-point-cards.util';
import { type AssignableMember } from 'src/engine/core-modules/task-pipelines/utils/resolve-action-item-assignee.util';

const yeison: AssignableMember = {
  workspaceMemberId: 'yeison',
  email: 'gtm@ptstax.com',
  firstName: 'Yeison',
  lastName: 'Bermúdez',
  aliases: ['Jay', 'JJ', 'Jason', 'Yeye'],
};
const mauro: AssignableMember = {
  workspaceMemberId: 'mauro',
  email: 'mauricio@ptsfinancialservices.com',
  firstName: 'Mauricio',
  lastName: 'Esparza',
  aliases: ['Mauro Sparza'],
};
const mateo: AssignableMember = {
  workspaceMemberId: 'mateo',
  email: 'mateo@mithub.club',
  firstName: 'Mateo',
  lastName: 'Valencia',
  aliases: [],
};
const members = [yeison, mauro, mateo];

describe('normalizeLlmCards', () => {
  it('maps names and aliases to members and splits a 2-person card', () => {
    const cards = normalizeLlmCards(
      {
        cards: [
          {
            title: 'Revisar tasa de rebote',
            description: 'Campaña de Facebook',
            members: ['Mateo Valencia', 'Jay'],
            timestamp: 2450.0,
            items: [
              {
                text: 'Sacar el reporte de Smartlead',
                assignee: 'Mateo Valencia',
              },
              { text: 'Decidir si se escala a 200', assignee: 'Jay' },
            ],
          },
        ],
      },
      members,
    );

    expect(cards).toEqual([
      {
        title: 'Revisar tasa de rebote',
        description: 'Campaña de Facebook',
        memberIds: ['mateo', 'yeison'],
        timestampSeconds: 2450,
        items: [
          { text: 'Sacar el reporte de Smartlead', assigneeId: 'mateo' },
          { text: 'Decidir si se escala a 200', assigneeId: 'yeison' },
        ],
      },
    ]);
  });

  it('members = people with points, not everyone mentioned', () => {
    const [card] = normalizeLlmCards(
      {
        cards: [
          {
            title: 'Dar acceso al CRM',
            members: ['Yeison Bermúdez', 'Mauricio Esparza', 'Mateo Valencia'],
            items: [
              {
                text: 'Dar acceso a Mauro y Mateo',
                assignee: 'Yeison Bermúdez',
              },
            ],
          },
        ],
      },
      members,
    );

    expect(card.memberIds).toEqual(['yeison']);
  });

  it('gives unowned points of a one-person card to that person', () => {
    const [card] = normalizeLlmCards(
      {
        cards: [
          {
            title: 'Pedir leads',
            members: ['Mauro'],
            items: [
              { text: 'Pedir a Alex 25 leads', assignee: null },
              { text: 'Enviar a Pilar', assignee: 'Mauricio Esparza' },
            ],
          },
        ],
      },
      members,
    );

    expect(card.items.map((item) => item.assigneeId)).toEqual([
      'mauro',
      'mauro',
    ]);
  });

  it('keeps team cards with members but unassigned points', () => {
    const [card] = normalizeLlmCards(
      {
        cards: [
          {
            title: 'Demo del CRM',
            members: ['Yeison Bermúdez', 'Mateo Valencia'],
            items: [{ text: 'Reunión de los 3', assignee: null }],
          },
        ],
      },
      members,
    );

    expect(card.memberIds).toEqual(['yeison', 'mateo']);
    expect(card.items[0].assigneeId).toBeNull();
  });

  it('drops strangers, empty items, duplicate titles and garbage', () => {
    const cards = normalizeLlmCards(
      {
        cards: [
          {
            title: 'Hablar con Pilar',
            members: ['Pilar Rodríguez'],
            items: [{ text: 'Llamar', assignee: 'Pilar Rodríguez' }],
          },
          { title: 'hablar con pilar', members: [], items: [] },
          { title: '', members: [], items: [{ text: '  ', assignee: null }] },
          'basura',
          null,
        ],
      },
      members,
    );

    expect(cards).toHaveLength(1);
    expect(cards[0].memberIds).toEqual([]);
    expect(cards[0].items).toEqual([{ text: 'Llamar', assigneeId: null }]);
  });

  it('returns nothing for a malformed answer', () => {
    expect(normalizeLlmCards({ foo: 1 }, members)).toEqual([]);
    expect(normalizeLlmCards(null, members)).toEqual([]);
  });
});

describe('cardsFromActionItems (fallback without AI)', () => {
  it('makes one card per item, assigned by mention', () => {
    const cards = cardsFromActionItems({
      items: [
        {
          description: 'Mauro: Pedir a Alex los 25 leads',
          recording_timestamp: '00:31:40',
        },
        { description: '   ' },
      ],
      members,
      invitees: [],
      transcript: [],
    });

    expect(cards).toEqual([
      {
        title: 'Mauro: Pedir a Alex los 25 leads',
        description: '',
        memberIds: ['mauro'],
        timestampSeconds: 1900,
        items: [
          { text: 'Mauro: Pedir a Alex los 25 leads', assigneeId: 'mauro' },
        ],
      },
    ]);
  });
});

describe('prompt + links', () => {
  it('lists members with aliases and Fathom items', () => {
    const prompt = buildActionPointsUserPrompt({
      title: 'GTM',
      startedAt: new Date('2026-09-28T15:00:00Z'),
      participants: [{ name: 'Mauro Sparza', email: null }],
      members,
      summaryMarkdown: '## Próximos pasos\n- Uno',
      fathomActionItems: [
        { description: 'Send deck', assignee: { name: 'Jay' } },
      ],
    });

    expect(prompt).toContain(
      '"name":"Yeison Bermúdez","aliases":["Jay","JJ","Jason","Yeye"]',
    );
    expect(prompt).toContain('- Send deck (asignado en Fathom: Jay)');
    expect(prompt).toContain('REUNIÓN: GTM (2026-09-28)');
  });

  it('builds the playback link at the exact second', () => {
    expect(playbackUrlAt('https://fathom.video/share/abc', 1884)).toBe(
      'https://fathom.video/share/abc?timestamp=1884',
    );
    expect(playbackUrlAt(null, 10)).toBeNull();
  });
});
