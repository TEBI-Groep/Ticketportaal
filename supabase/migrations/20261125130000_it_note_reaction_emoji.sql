-- Store reaction kind as the emoji itself (was thumbs_up slug only).

alter table public.it_note_reactions
  drop constraint if exists it_note_reactions_kind_check;

-- Migrate any existing slug rows to the emoji glyph.
update public.it_note_reactions
set kind = '👍'
where kind = 'thumbs_up';

alter table public.it_note_reactions
  alter column kind set default '👍';

-- Keep reactions to a single emoji / short grapheme cluster.
alter table public.it_note_reactions
  add constraint it_note_reactions_kind_len
  check (char_length(kind) between 1 and 16);
