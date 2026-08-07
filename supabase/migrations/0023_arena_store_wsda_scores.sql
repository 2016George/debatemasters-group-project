-- Include side-specific WSDA scorecards in stored arena debate results.

create or replace function public.arena_store_judged_result(
  p_room uuid,
  p_judgement jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dr public.debate_rooms%rowtype;
  v_uid uuid := auth.uid();
  v_judgement jsonb;
  v_winner text;
  v_topic text;
  v_rationale text;
  v_confidence numeric;
  v_transcript jsonb;

  v_pro_feedback text;
  v_con_feedback text;
  v_pro_quote text;
  v_con_quote text;
  v_pro_clarity numeric;
  v_con_clarity numeric;
  v_pro_evidence numeric;
  v_con_evidence numeric;
  v_pro_wsda jsonb;
  v_con_wsda jsonb;

  v_debated_at timestamptz := now();
  participant uuid;
  participant_side text;
  participant_outcome text;
  participant_headline text;
  participant_subline text;
  participant_result_id text;
  participant_payload jsonb;
  participant_feedback text;
  participant_quote text;
  participant_clarity numeric;
  participant_evidence numeric;
  participant_wsda jsonb;
  participant_scores jsonb;
  caller_payload jsonb := null;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  set local row_security to off;

  select * into dr from public.debate_rooms where id = p_room;
  if not found then
    return jsonb_build_object('status', 'error', 'message', 'room not found');
  end if;
  if v_uid <> dr.pro_user_id and v_uid <> dr.con_user_id then
    return jsonb_build_object('status', 'error', 'message', 'not a participant');
  end if;

  select judgement into v_judgement
  from public.arena_judgements
  where room_id = p_room;

  if v_judgement is null then
    v_judgement := coalesce(p_judgement, '{}'::jsonb);
    insert into public.arena_judgements (room_id, judgement, created_by_user_id)
    values (p_room, v_judgement, v_uid)
    on conflict (room_id) do update
      set judgement = public.arena_judgements.judgement
    returning judgement into v_judgement;
  end if;

  v_winner := lower(coalesce(v_judgement->>'winner_side', 'pro'));
  if v_winner <> 'con' then
    v_winner := 'pro';
  end if;
  v_topic := coalesce(v_judgement->>'topic_title', dr.topic_title, 'Arena Debate');
  v_rationale := coalesce(v_judgement->>'rationale', 'Winner chosen by AI judge.');
  v_confidence := least(greatest(coalesce((v_judgement->>'confidence')::numeric, 0.65), 0), 1);
  v_transcript := coalesce(v_judgement->'transcript', '[]'::jsonb);

  v_pro_feedback := coalesce(
    v_judgement->>'pro_feedback',
    v_judgement->>'feedback',
    'AI judge feedback unavailable.'
  );
  v_con_feedback := coalesce(
    v_judgement->>'con_feedback',
    v_judgement->>'feedback',
    'AI judge feedback unavailable.'
  );

  v_pro_quote := coalesce(
    v_judgement->>'pro_quote',
    v_judgement->>'quote',
    'A clear claim is strongest when it is proven.'
  );
  v_con_quote := coalesce(
    v_judgement->>'con_quote',
    v_judgement->>'quote',
    'A clear claim is strongest when it is proven.'
  );

  v_pro_clarity := least(greatest(coalesce((v_judgement->>'pro_clarity_score')::numeric, (v_judgement->>'clarity_score')::numeric, 3.5), 0), 5);
  v_con_clarity := least(greatest(coalesce((v_judgement->>'con_clarity_score')::numeric, (v_judgement->>'clarity_score')::numeric, 3.5), 0), 5);
  v_pro_evidence := least(greatest(coalesce((v_judgement->>'pro_evidence_score')::numeric, (v_judgement->>'evidence_score')::numeric, 3.5), 0), 5);
  v_con_evidence := least(greatest(coalesce((v_judgement->>'con_evidence_score')::numeric, (v_judgement->>'evidence_score')::numeric, 3.5), 0), 5);

  v_pro_wsda := v_judgement->'pro_wsda';
  v_con_wsda := v_judgement->'con_wsda';

  foreach participant in array array[dr.pro_user_id, dr.con_user_id]
  loop
    if participant is null then
      continue;
    end if;

    participant_side := case when participant = dr.pro_user_id then 'pro' else 'con' end;
    participant_outcome := case when participant_side = v_winner then 'victory' else 'effort' end;
    participant_headline := case when participant_outcome = 'victory' then 'ARENA AI VERDICT: VICTORY' else 'ARENA AI VERDICT: REVIEW' end;
    participant_subline := format(
      'Winner: %s (%s%% confidence)',
      upper(v_winner),
      round(v_confidence * 100)
    );
    participant_result_id := format('judged_%s_%s', p_room::text, participant::text);

    if participant_side = 'pro' then
      participant_feedback := v_pro_feedback;
      participant_quote := v_pro_quote;
      participant_clarity := v_pro_clarity;
      participant_evidence := v_pro_evidence;
      participant_wsda := v_pro_wsda;
    else
      participant_feedback := v_con_feedback;
      participant_quote := v_con_quote;
      participant_clarity := v_con_clarity;
      participant_evidence := v_con_evidence;
      participant_wsda := v_con_wsda;
    end if;

    participant_scores := jsonb_build_object(
      'clarity', participant_clarity,
      'evidence', participant_evidence
    );
    if participant_wsda is not null and participant_wsda <> 'null'::jsonb then
      participant_scores := participant_scores || jsonb_build_object('wsda', participant_wsda);
    end if;

    participant_payload := jsonb_build_object(
      'id', participant_result_id,
      'arenaRoomId', p_room::text,
      'topicTitle', v_topic,
      'debatedAt', to_jsonb(v_debated_at),
      'outcome', participant_outcome,
      'headline', participant_headline,
      'subline', participant_subline,
      'level', case when participant_outcome = 'victory' then 47 else 46 end,
      'xpCurrent', case when participant_outcome = 'victory' then 2900 else 2740 end,
      'xpToNext', 3300,
      'xpEarned', case when participant_outcome = 'victory' then 170 else 90 end,
      'feedback', concat(participant_feedback, ' Decision rationale: ', v_rationale),
      'quote', participant_quote,
      'scores', participant_scores,
      'suggestedTomes', jsonb_build_array(
        jsonb_build_object(
          'title', case when participant_outcome = 'victory' then 'Ballot Conversion' else 'Comparative Weighing' end,
          'subtitle', case when participant_outcome = 'victory' then 'Close with clear voters' else 'Strengthen clash framing' end,
          'kind', 'rare',
          'label', case when participant_outcome = 'victory' then '+3 Focus' else '+2 Focus' end,
          'accent', 'primary',
          'icon', 'menu_book'
        ),
        jsonb_build_object(
          'title', case when participant_outcome = 'victory' then 'Round Presence II' else 'Rebuttal Rebuild I' end,
          'subtitle', case when participant_outcome = 'victory' then 'Sustain pressure cleanly' else 'Address warrants directly' end,
          'kind', 'enchanted',
          'label', case when participant_outcome = 'victory' then '+2 Lvl' else '+1 Lvl' end,
          'accent', 'tertiary',
          'icon', 'psychology'
        )
      ),
      'loot', jsonb_build_array(
        jsonb_build_object(
          'label', case when participant_outcome = 'victory' then 'Arena Sigil x1' else 'Practice Token x35' end,
          'tone', case when participant_outcome = 'victory' then 'emerald' else 'gold' end
        )
      ),
      'transcript', v_transcript
    );

    insert into public.debate_results (
      id,
      user_id,
      payload,
      debated_at,
      hidden,
      arena_room_id
    ) values (
      participant_result_id,
      participant,
      participant_payload,
      v_debated_at,
      false,
      p_room
    )
    on conflict (id) do update
      set payload = excluded.payload,
          debated_at = excluded.debated_at,
          hidden = false,
          arena_room_id = excluded.arena_room_id;

    if participant = v_uid then
      caller_payload := participant_payload;
    end if;
  end loop;

  if caller_payload is null then
    return jsonb_build_object('status', 'error', 'message', 'caller result missing');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'payload', caller_payload
  );
end;
$$;

revoke all on function public.arena_store_judged_result(uuid, jsonb) from public;
grant execute on function public.arena_store_judged_result(uuid, jsonb) to authenticated;
