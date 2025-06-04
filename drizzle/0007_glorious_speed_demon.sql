DROP VIEW "public"."chat_message_stats";--> statement-breakpoint
CREATE VIEW "public"."chat_message_stats" AS (
    SELECT 
      jc.platform, 
      jc.chat_id, 
      jc.chat_name, 
      COUNT(cm.id)::int AS message_count,
      MIN(cm.platform_message_id) AS first_message_id,
      MIN(cm.created_at) AS first_message_at,
      MAX(cm.platform_message_id) AS latest_message_id,
      MAX(cm.created_at) AS latest_message_at
    FROM joined_chats jc
    LEFT JOIN chat_messages cm ON jc.chat_id = cm.in_chat_id
    GROUP BY jc.platform, jc.chat_id, jc.chat_name
  );