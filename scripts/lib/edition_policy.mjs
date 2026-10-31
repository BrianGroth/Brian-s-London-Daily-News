const mix = ['near home', 'near home', 'near home', 'near home', 'near work', 'near work', 'london ai', 'london technology', 'plan ahead', 'plan ahead'];

// Standard editions remain strict. A shorter edition needs an explicit, visible
// editorial explanation, retained with the issue when it enters the archive.
export function assertStoryMix(issue) {
  const stories = issue?.stories;
  if (!Array.isArray(stories)) throw new Error('Missing edition stories.');
  const actual = stories.map(story => story.section?.toLowerCase());
  if (issue.shortEditionReason === undefined) {
    if (JSON.stringify(actual) !== JSON.stringify(mix)) throw new Error('Edition must contain exactly ten stories in the adjacent 4/2/1/1/2 section mix.');
    return;
  }
  if (typeof issue.shortEditionReason !== 'string' || !issue.shortEditionReason.trim()) throw new Error('A shorter edition requires an editorial explanation.');
  if (stories.length < 1 || stories.length >= 10) throw new Error('A shorter edition must contain one to nine stories.');
  let next = 0;
  for (const section of actual) {
    const position = mix.indexOf(section, next);
    if (position < 0) throw new Error('Short editions must preserve section order and maximum section counts.');
    next = position + 1;
  }
}
