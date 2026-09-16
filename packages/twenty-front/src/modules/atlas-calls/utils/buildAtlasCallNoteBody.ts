import { v4 } from 'uuid';

// Cuerpo de nota en formato BlockNote (un párrafo por línea) + markdown.
export const buildAtlasCallNoteBody = (lines: string[]) => {
  const blocknote = lines.map((line) => ({
    id: v4(),
    type: 'paragraph',
    props: {
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left',
    },
    content: [{ type: 'text', text: line, styles: {} }],
    children: [],
  }));

  return {
    blocknote: JSON.stringify(blocknote),
    markdown: lines.join('\n\n'),
  };
};
