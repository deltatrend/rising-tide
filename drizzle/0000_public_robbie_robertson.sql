CREATE TABLE "amendments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "amendments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"legiscan_amendment_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	"adopted" boolean DEFAULT false NOT NULL,
	"chamber" text,
	"chamber_id" integer,
	"amendment_date" date,
	"title" text,
	"description" text,
	"mime_type" text,
	"mime_id" integer,
	"size_bytes" integer,
	"amendment_hash" text,
	"legiscan_url" text,
	"state_url" text,
	"is_cached" boolean DEFAULT false NOT NULL,
	"r2_object_id" integer,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"period_month" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'legiscan' NOT NULL,
	"queries_used" integer DEFAULT 0 NOT NULL,
	"monthly_limit" integer DEFAULT 30000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_actions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bill_actions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bill_id" integer NOT NULL,
	"sequence" integer NOT NULL,
	"action_date" date,
	"action" text NOT NULL,
	"chamber" text,
	"chamber_id" integer,
	"is_major" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_classifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bill_classifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bill_id" integer NOT NULL,
	"classifier_version" text NOT NULL,
	"provider" text DEFAULT 'deterministic' NOT NULL,
	"relevant" boolean NOT NULL,
	"score" integer NOT NULL,
	"reason" text NOT NULL,
	"topics" jsonb NOT NULL,
	"evidence" jsonb NOT NULL,
	"classified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_committee_referrals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bill_committee_referrals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bill_id" integer NOT NULL,
	"committee_id" integer NOT NULL,
	"referred_on" date,
	"sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bill_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"legiscan_doc_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	"version_type" text,
	"version_type_id" integer,
	"document_date" date,
	"mime_type" text,
	"mime_id" integer,
	"size_bytes" integer,
	"text_hash" text,
	"legiscan_url" text,
	"state_url" text,
	"is_cached" boolean DEFAULT false NOT NULL,
	"r2_object_id" integer,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_sponsors" (
	"bill_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"sponsor_type_id" integer,
	"sponsor_order" integer,
	"committee_sponsor" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_sponsors_bill_id_person_id_pk" PRIMARY KEY("bill_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "bill_topics" (
	"bill_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_topics_bill_id_topic_id_pk" PRIMARY KEY("bill_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"legiscan_bill_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"slug" text NOT NULL,
	"state" text DEFAULT 'NY' NOT NULL,
	"bill_number" text NOT NULL,
	"bill_type" text,
	"bill_type_id" integer,
	"body" text,
	"body_id" integer,
	"current_body" text,
	"current_body_id" integer,
	"title" text NOT NULL,
	"description" text,
	"status_id" integer,
	"status_date" date,
	"last_action" text,
	"last_action_date" date,
	"pending_committee_id" integer,
	"legiscan_url" text,
	"state_url" text,
	"change_hash" text,
	"previous_change_hash" text,
	"progress" jsonb,
	"subjects" jsonb,
	"raw" jsonb,
	"is_tracked" boolean DEFAULT false NOT NULL,
	"relevance_score" integer,
	"plain_language_summary" text,
	"why_it_matters" text,
	"advocacy_note" text,
	"editorial_priority" integer,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_source_change_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "classification_overrides" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "classification_overrides_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bill_id" integer NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "committees_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"legiscan_committee_id" integer,
	"name" text NOT NULL,
	"chamber" text,
	"chamber_id" integer,
	"slug" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_bills" (
	"event_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	CONSTRAINT "event_bills_event_id_bill_id_pk" PRIMARY KEY("event_id","bill_id")
);
--> statement-breakpoint
CREATE TABLE "event_topics" (
	"event_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	CONSTRAINT "event_topics_event_id_topic_id_pk" PRIMARY KEY("event_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"title" text NOT NULL,
	"event_type" text,
	"event_type_id" integer,
	"event_date" date NOT NULL,
	"start_time" text,
	"end_time" text,
	"location" text,
	"description" text,
	"raw" jsonb,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "individual_votes" (
	"roll_call_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"vote_id" integer NOT NULL,
	"vote_text" text NOT NULL,
	CONSTRAINT "individual_votes_roll_call_id_person_id_pk" PRIMARY KEY("roll_call_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "people_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"legiscan_people_id" integer NOT NULL,
	"person_hash" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"first_name" text,
	"middle_name" text,
	"last_name" text,
	"suffix" text,
	"nickname" text,
	"party_id" integer,
	"party" text,
	"role_id" integer,
	"role" text,
	"district" text,
	"ballotpedia" text,
	"votesmart_id" integer,
	"ftm_eid" text,
	"knowwho_pid" integer,
	"committee_sponsor" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "r2_objects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "r2_objects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"object_key" text NOT NULL,
	"bucket" text NOT NULL,
	"document_kind" text NOT NULL,
	"external_document_id" integer NOT NULL,
	"bill_id" integer,
	"content_type" text,
	"size_bytes" integer,
	"checksum" text,
	"source_url" text,
	"stored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "related_bills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "related_bills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bill_id" integer NOT NULL,
	"related_legiscan_bill_id" integer NOT NULL,
	"related_bill_number" text,
	"relation_type_id" integer NOT NULL,
	"relation_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roll_calls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roll_calls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"legiscan_roll_call_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	"vote_date" date,
	"description" text,
	"chamber" text,
	"chamber_id" integer,
	"yea" integer DEFAULT 0 NOT NULL,
	"nay" integer DEFAULT 0 NOT NULL,
	"not_voting" integer DEFAULT 0 NOT NULL,
	"absent" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"passed" boolean,
	"legiscan_url" text,
	"state_url" text,
	"has_individual_votes" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"legiscan_session_id" integer NOT NULL,
	"state" text DEFAULT 'NY' NOT NULL,
	"state_id" integer,
	"year_start" integer NOT NULL,
	"year_end" integer NOT NULL,
	"prefile" boolean DEFAULT false NOT NULL,
	"sine_die" boolean DEFAULT false NOT NULL,
	"prior" boolean DEFAULT false NOT NULL,
	"special" boolean DEFAULT false NOT NULL,
	"session_tag" text,
	"session_title" text,
	"session_name" text,
	"dataset_hash" text,
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"legiscan_supplement_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	"supplement_type_id" integer,
	"supplement_type" text,
	"title" text,
	"description" text,
	"supplement_date" date,
	"mime_type" text,
	"mime_id" integer,
	"size_bytes" integer,
	"supplement_hash" text,
	"legiscan_url" text,
	"state_url" text,
	"is_cached" boolean DEFAULT false NOT NULL,
	"r2_object_id" integer,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"trigger_type" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"session_id" integer,
	"classifier_version" text,
	"queries_consumed" integer DEFAULT 0 NOT NULL,
	"candidates_discovered" integer DEFAULT 0 NOT NULL,
	"bills_inserted" integer DEFAULT 0 NOT NULL,
	"bills_updated" integer DEFAULT 0 NOT NULL,
	"bills_unchanged" integer DEFAULT 0 NOT NULL,
	"bills_rejected" integer DEFAULT 0 NOT NULL,
	"roll_calls_updated" integer DEFAULT 0 NOT NULL,
	"events_upserted" integer DEFAULT 0 NOT NULL,
	"documents_fetched" integer DEFAULT 0 NOT NULL,
	"documents_stored" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "topics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text NOT NULL,
	"long_description" text,
	"category" text,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_r2_object_id_r2_objects_id_fk" FOREIGN KEY ("r2_object_id") REFERENCES "public"."r2_objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_actions" ADD CONSTRAINT "bill_actions_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_classifications" ADD CONSTRAINT "bill_classifications_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_committee_referrals" ADD CONSTRAINT "bill_committee_referrals_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_committee_referrals" ADD CONSTRAINT "bill_committee_referrals_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_documents" ADD CONSTRAINT "bill_documents_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_documents" ADD CONSTRAINT "bill_documents_r2_object_id_r2_objects_id_fk" FOREIGN KEY ("r2_object_id") REFERENCES "public"."r2_objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_sponsors" ADD CONSTRAINT "bill_sponsors_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_sponsors" ADD CONSTRAINT "bill_sponsors_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_topics" ADD CONSTRAINT "bill_topics_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_topics" ADD CONSTRAINT "bill_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_pending_committee_id_committees_id_fk" FOREIGN KEY ("pending_committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_overrides" ADD CONSTRAINT "classification_overrides_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bills" ADD CONSTRAINT "event_bills_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bills" ADD CONSTRAINT "event_bills_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_topics" ADD CONSTRAINT "event_topics_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_topics" ADD CONSTRAINT "event_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_votes" ADD CONSTRAINT "individual_votes_roll_call_id_roll_calls_id_fk" FOREIGN KEY ("roll_call_id") REFERENCES "public"."roll_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_votes" ADD CONSTRAINT "individual_votes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r2_objects" ADD CONSTRAINT "r2_objects_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "related_bills" ADD CONSTRAINT "related_bills_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_calls" ADD CONSTRAINT "roll_calls_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplements" ADD CONSTRAINT "supplements_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplements" ADD CONSTRAINT "supplements_r2_object_id_r2_objects_id_fk" FOREIGN KEY ("r2_object_id") REFERENCES "public"."r2_objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amendments_legiscan_id_key" ON "amendments" USING btree ("legiscan_amendment_id");--> statement-breakpoint
CREATE INDEX "amendments_bill_idx" ON "amendments" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "api_usage_provider_idx" ON "api_usage" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_actions_bill_sequence_key" ON "bill_actions" USING btree ("bill_id","sequence");--> statement-breakpoint
CREATE INDEX "bill_actions_date_idx" ON "bill_actions" USING btree ("action_date");--> statement-breakpoint
CREATE INDEX "bill_actions_bill_idx" ON "bill_actions" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_classifications_bill_key" ON "bill_classifications" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_classifications_score_idx" ON "bill_classifications" USING btree ("score");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_committee_referrals_key" ON "bill_committee_referrals" USING btree ("bill_id","committee_id","sequence");--> statement-breakpoint
CREATE INDEX "bill_committee_referrals_committee_idx" ON "bill_committee_referrals" USING btree ("committee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_documents_legiscan_doc_id_key" ON "bill_documents" USING btree ("legiscan_doc_id");--> statement-breakpoint
CREATE INDEX "bill_documents_bill_idx" ON "bill_documents" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_sponsors_person_idx" ON "bill_sponsors" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "bill_sponsors_type_idx" ON "bill_sponsors" USING btree ("sponsor_type_id");--> statement-breakpoint
CREATE INDEX "bill_topics_topic_idx" ON "bill_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_legiscan_bill_id_key" ON "bills" USING btree ("legiscan_bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_slug_key" ON "bills" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "bills_session_idx" ON "bills" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "bills_tracked_idx" ON "bills" USING btree ("is_tracked");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "bills_bill_number_idx" ON "bills" USING btree ("bill_number");--> statement-breakpoint
CREATE INDEX "bills_last_action_date_idx" ON "bills" USING btree ("last_action_date");--> statement-breakpoint
CREATE INDEX "bills_source_change_idx" ON "bills" USING btree ("last_source_change_at");--> statement-breakpoint
CREATE INDEX "bills_current_body_idx" ON "bills" USING btree ("current_body");--> statement-breakpoint
CREATE INDEX "bills_pending_committee_idx" ON "bills" USING btree ("pending_committee_id");--> statement-breakpoint
CREATE INDEX "bills_relevance_idx" ON "bills" USING btree ("relevance_score");--> statement-breakpoint
CREATE INDEX "bills_search_idx" ON "bills" USING gin (to_tsvector('english', "bill_number" || ' ' || "title" || ' ' || coalesce("description", '')));--> statement-breakpoint
CREATE UNIQUE INDEX "classification_overrides_bill_key" ON "classification_overrides" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "classification_overrides_decision_idx" ON "classification_overrides" USING btree ("decision");--> statement-breakpoint
CREATE UNIQUE INDEX "committees_slug_key" ON "committees" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "committees_legiscan_id_key" ON "committees" USING btree ("legiscan_committee_id");--> statement-breakpoint
CREATE INDEX "committees_chamber_idx" ON "committees" USING btree ("chamber");--> statement-breakpoint
CREATE INDEX "event_bills_bill_idx" ON "event_bills" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "event_topics_topic_idx" ON "event_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_source_external_id_key" ON "events" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "events_source_idx" ON "events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "individual_votes_person_idx" ON "individual_votes" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_legiscan_people_id_key" ON "people" USING btree ("legiscan_people_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_slug_key" ON "people" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "people_name_idx" ON "people" USING btree ("name");--> statement-breakpoint
CREATE INDEX "people_role_party_idx" ON "people" USING btree ("role","party");--> statement-breakpoint
CREATE UNIQUE INDEX "r2_objects_object_key_key" ON "r2_objects" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "r2_objects_document_key" ON "r2_objects" USING btree ("document_kind","external_document_id");--> statement-breakpoint
CREATE INDEX "r2_objects_bill_idx" ON "r2_objects" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "related_bills_key" ON "related_bills" USING btree ("bill_id","related_legiscan_bill_id","relation_type_id");--> statement-breakpoint
CREATE INDEX "related_bills_related_idx" ON "related_bills" USING btree ("related_legiscan_bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roll_calls_legiscan_id_key" ON "roll_calls" USING btree ("legiscan_roll_call_id");--> statement-breakpoint
CREATE INDEX "roll_calls_bill_idx" ON "roll_calls" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "roll_calls_date_idx" ON "roll_calls" USING btree ("vote_date");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_legiscan_session_id_key" ON "sessions" USING btree ("legiscan_session_id");--> statement-breakpoint
CREATE INDEX "sessions_state_year_idx" ON "sessions" USING btree ("state","year_start");--> statement-breakpoint
CREATE UNIQUE INDEX "supplements_legiscan_id_key" ON "supplements" USING btree ("legiscan_supplement_id");--> statement-breakpoint
CREATE INDEX "supplements_bill_idx" ON "supplements" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "sync_runs_started_idx" ON "sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sync_runs_status_idx" ON "sync_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_slug_key" ON "topics" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "topics_sort_idx" ON "topics" USING btree ("sort_order");