const mix = ['near home', 'near home', 'near home', 'near home', 'near work', 'near work', 'london ai', 'london technology', 'plan ahead', 'plan ahead'];

// Quality sets the edition length. Preserve order and section caps, never pad.
export function assertStoryMix(issue) {
  const stories = issue?.stories;
  if (!Array.isArray(stories)) throw new Error('Missing edition stories.');
  const actual = stories.map(story => story.section?.toLowerCase());
  if (issue.shortEditionReason !== undefined && (typeof issue.shortEditionReason !== 'string' || !issue.shortEditionReason.trim())) throw new Error('An editorial explanation must be nonempty text.');
  if (stories.length < 1 || stories.length > 10) throw new Error('Edition must contain one to ten justified stories.');
  let next = 0;
  for (const section of actual) {
    const position = mix.indexOf(section, next);
    if (position < 0) throw new Error('Editions must preserve section order and maximum section counts (4/2/1/1/2).');
    next = position + 1;
  }
}
