CREATE TABLE "push_tickets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"ticket_id" text NOT NULL,
	"expo_push_token" text NOT NULL,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tickets_ticket_id_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
ALTER TABLE "push_tickets" ADD CONSTRAINT "push_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_tickets_user_idx" ON "push_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_tickets_unchecked_idx" ON "push_tickets" USING btree ("created_at") WHERE "push_tickets"."checked_at" is null;