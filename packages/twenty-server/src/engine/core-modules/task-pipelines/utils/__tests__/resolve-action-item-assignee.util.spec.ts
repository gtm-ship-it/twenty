import {
  resolveActionItemAssignee,
  type AssignableMember,
} from 'src/engine/core-modules/task-pipelines/utils/resolve-action-item-assignee.util';

const yeison: AssignableMember = {
  workspaceMemberId: 'yeison',
  email: 'gtm@ptstax.com',
  firstName: 'Yeison',
  lastName: 'Bermúdez',
  aliases: ['Jason', 'Jay', 'Yeye', 'yeisonb@ptsfinancialservices.com'],
};
const mauro: AssignableMember = {
  workspaceMemberId: 'mauro',
  email: 'mauricio@ptsfinancialservices.com',
  firstName: 'Mauricio',
  lastName: 'Esparza',
  aliases: ['Mauro Sparza', 'contacto@mithub.club'],
};
const mateo: AssignableMember = {
  workspaceMemberId: 'mateo',
  email: 'mateo@mithub.club',
  firstName: 'Mateo',
  lastName: 'Valencia',
  aliases: ['Teo'],
};
const members = [yeison, mauro, mateo];

const base = {
  description: 'Follow up',
  recordingTimestamp: null,
  invitees: [],
  transcript: [],
  members,
};

describe('resolveActionItemAssignee', () => {
  it('matches by assignee email (case-insensitive)', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: { name: null, email: 'GTM@PTSTAX.com' },
      }),
    ).toEqual({ workspaceMemberId: 'yeison', resolution: 'EMAIL' });
  });

  it('matches by an email alias', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: { name: 'X', email: 'contacto@mithub.club' },
      }).workspaceMemberId,
    ).toBe('mauro');
  });

  it('matches by name alias (Fathom calls Yeison "Jason")', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: { name: 'Jason', email: null },
      }),
    ).toEqual({ workspaceMemberId: 'yeison', resolution: 'ALIAS' });
  });

  it('matches by full name ignoring accents', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: { name: 'yeison bermudez', email: null },
      }).resolution,
    ).toBe('NAME');
  });

  it('matches by first name token', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: { name: 'Mateo V.', email: null },
      }).workspaceMemberId,
    ).toBe('mateo');
  });

  it('resolves through a calendar invitee', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: { name: 'M. Esparza', email: null },
        invitees: [
          { name: 'M. Esparza', email: 'mauricio@ptsfinancialservices.com' },
        ],
      }),
    ).toEqual({ workspaceMemberId: 'mauro', resolution: 'INVITEE' });
  });

  it('resolves by a single mention in the description', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: null,
        description: 'Teo to set the sender account for the 50 leads',
      }),
    ).toEqual({ workspaceMemberId: 'mateo', resolution: 'MENTION' });
  });

  it('resolves a mention by the first name of an alias', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: null,
        description: 'Mauro pedirá a Alex 25 leads de D-Ladder',
      }),
    ).toEqual({ workspaceMemberId: 'mauro', resolution: 'MENTION' });
  });

  it('does not use mention when two members are named', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: null,
        description: 'Mateo and Mauricio align on the brand book',
      }).resolution,
    ).toBe('NONE');
  });

  it('falls back to the speaker at that second', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: null,
        recordingTimestamp: '00:10:05',
        transcript: [
          {
            speakerName: 'Mauro Sparza',
            speakerEmail: null,
            timestamp: '00:09:00',
          },
          {
            speakerName: 'Mateo Valencia',
            speakerEmail: null,
            timestamp: '00:10:30',
          },
        ],
      }),
    ).toEqual({ workspaceMemberId: 'mauro', resolution: 'SPEAKER' });
  });

  it('assigns to the only member of a personal board', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        members: [yeison],
        assignee: { name: 'Someone', email: null },
      }),
    ).toEqual({ workspaceMemberId: 'yeison', resolution: 'SOLE_MEMBER' });
  });

  it('does not guess by speaker when Fathom named an outsider', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: { name: 'Pilar Rodriguez', email: 'pilar@client.com' },
        recordingTimestamp: '00:10:05',
        transcript: [
          {
            speakerName: 'Mauro Sparza',
            speakerEmail: null,
            timestamp: '00:09:00',
          },
        ],
      }),
    ).toEqual({ workspaceMemberId: null, resolution: 'NONE' });
  });

  it('returns NONE for an outsider', () => {
    expect(
      resolveActionItemAssignee({
        ...base,
        assignee: { name: 'Pilar Rodriguez', email: 'pilar@x.com' },
      }),
    ).toEqual({ workspaceMemberId: null, resolution: 'NONE' });
  });
});
