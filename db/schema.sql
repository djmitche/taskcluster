```sql
CREATE TABLE access_tokens (
    encrypted_access_token jsonb NOT NULL,
    hashed_access_token text NOT NULL,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    identity text NOT NULL,
    identity_provider_id text NOT NULL,
    expires timestamp with time zone NOT NULL,
    client_details jsonb NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE authorization_codes (
    code text NOT NULL,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    identity text NOT NULL,
    identity_provider_id text NOT NULL,
    expires timestamp with time zone NOT NULL,
    client_details jsonb NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE azure_queue_messages (
    message_id uuid NOT NULL,
    queue_name text NOT NULL,
    message_text text NOT NULL,
    inserted timestamp with time zone NOT NULL,
    visible timestamp with time zone NOT NULL,
    expires timestamp with time zone NOT NULL,
    pop_receipt uuid
);
```

```sql
CREATE TABLE cache_purges (
    provisioner_id text NOT NULL,
    worker_type text NOT NULL,
    cache_name text NOT NULL,
    before timestamp with time zone NOT NULL,
    expires timestamp with time zone NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE clients (
    client_id text NOT NULL,
    description text NOT NULL,
    encrypted_access_token jsonb NOT NULL,
    expires timestamp with time zone NOT NULL,
    disabled boolean NOT NULL,
    scopes jsonb NOT NULL,
    created timestamp with time zone NOT NULL,
    last_modified timestamp with time zone NOT NULL,
    last_date_used timestamp with time zone NOT NULL,
    last_rotated timestamp with time zone NOT NULL,
    delete_on_expiration boolean NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE denylisted_notifications (
    notification_type text NOT NULL,
    notification_address text NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid()
);
```

```sql
CREATE TABLE github_access_tokens (
    user_id text NOT NULL,
    encrypted_access_token jsonb NOT NULL
);
```

```sql
CREATE TABLE github_builds (
    organization text NOT NULL,
    repository text NOT NULL,
    sha text NOT NULL,
    task_group_id text NOT NULL,
    state text NOT NULL,
    created timestamp with time zone NOT NULL,
    updated timestamp with time zone NOT NULL,
    installation_id integer NOT NULL,
    event_type text NOT NULL,
    event_id text NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE github_checks (
    task_group_id text NOT NULL,
    task_id text NOT NULL,
    check_suite_id text NOT NULL,
    check_run_id text NOT NULL
);
```

```sql
CREATE TABLE github_integrations (
    owner text NOT NULL,
    installation_id integer NOT NULL
);
```

```sql
CREATE TABLE hooks (
    hook_group_id text NOT NULL,
    hook_id text NOT NULL,
    metadata jsonb NOT NULL,
    task jsonb NOT NULL,
    bindings jsonb NOT NULL,
    schedule jsonb NOT NULL,
    encrypted_trigger_token jsonb NOT NULL,
    encrypted_next_task_id jsonb NOT NULL,
    next_scheduled_date timestamp with time zone NOT NULL,
    trigger_schema jsonb NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE hooks_last_fires (
    hook_group_id text NOT NULL,
    hook_id text NOT NULL,
    fired_by text NOT NULL,
    task_id text NOT NULL,
    task_create_time timestamp with time zone NOT NULL,
    result text NOT NULL,
    error text NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE hooks_queues (
    hook_group_id text NOT NULL,
    hook_id text NOT NULL,
    queue_name text NOT NULL,
    bindings jsonb NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE index_namespaces (
    parent text NOT NULL,
    name text NOT NULL,
    expires timestamp with time zone NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE indexed_tasks (
    namespace text NOT NULL,
    name text NOT NULL,
    rank integer NOT NULL,
    task_id text NOT NULL,
    data jsonb NOT NULL,
    expires timestamp with time zone NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE queue_artifacts (
    task_id text NOT NULL,
    run_id integer NOT NULL,
    name text NOT NULL,
    storage_type text NOT NULL,
    content_type text NOT NULL,
    details jsonb NOT NULL,
    present boolean NOT NULL,
    expires timestamp with time zone NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE queue_provisioner_entities (
    partition_key text NOT NULL,
    row_key text NOT NULL,
    value jsonb NOT NULL,
    version integer NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid()
);
```

```sql
CREATE TABLE queue_worker_entities (
    partition_key text NOT NULL,
    row_key text NOT NULL,
    value jsonb NOT NULL,
    version integer NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid()
);
```

```sql
CREATE TABLE queue_worker_type_entities (
    partition_key text NOT NULL,
    row_key text NOT NULL,
    value jsonb NOT NULL,
    version integer NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid()
);
```

```sql
CREATE TABLE roles (
    role_id text NOT NULL,
    scopes jsonb NOT NULL,
    created timestamp with time zone NOT NULL,
    description text NOT NULL,
    last_modified timestamp with time zone NOT NULL,
    etag uuid NOT NULL
);
```

```sql
CREATE TABLE secrets_entities (
    partition_key text NOT NULL,
    row_key text NOT NULL,
    value jsonb NOT NULL,
    version integer NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid()
);
```

```sql
CREATE TABLE sessions (
    hashed_session_id text NOT NULL,
    encrypted_session_id jsonb NOT NULL,
    data jsonb NOT NULL,
    expires timestamp with time zone NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE task_dependencies (
    dependent_task_id text NOT NULL,
    required_task_id text NOT NULL,
    requires public.task_requires NOT NULL,
    satisfied boolean NOT NULL,
    expires timestamp with time zone NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE task_groups (
    task_group_id text NOT NULL,
    scheduler_id text NOT NULL,
    expires timestamp with time zone NOT NULL,
    etag uuid NOT NULL
);
```

```sql
CREATE TABLE tasks (
    task_id text NOT NULL,
    provisioner_id text NOT NULL,
    worker_type text NOT NULL,
    scheduler_id text NOT NULL,
    task_group_id text NOT NULL,
    dependencies jsonb NOT NULL,
    requires public.task_requires NOT NULL,
    routes jsonb NOT NULL,
    priority public.task_priority NOT NULL,
    retries integer NOT NULL,
    retries_left integer NOT NULL,
    created timestamp with time zone NOT NULL,
    deadline timestamp with time zone NOT NULL,
    expires timestamp with time zone NOT NULL,
    scopes jsonb NOT NULL,
    payload jsonb NOT NULL,
    metadata jsonb NOT NULL,
    tags jsonb NOT NULL,
    extra jsonb NOT NULL,
    runs jsonb NOT NULL,
    taken_until timestamp with time zone,
    ever_resolved boolean NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE tcversion (
    version integer
);
```

```sql
CREATE TABLE worker_pool_errors (
    error_id text NOT NULL,
    worker_pool_id text NOT NULL,
    reported timestamp with time zone NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    extra jsonb,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE worker_pools (
    worker_pool_id text NOT NULL,
    provider_id text NOT NULL,
    owner text NOT NULL,
    description text NOT NULL,
    email_on_error boolean NOT NULL,
    created timestamp with time zone NOT NULL,
    last_modified timestamp with time zone NOT NULL,
    config jsonb NOT NULL,
    provider_data jsonb NOT NULL,
    previous_provider_ids jsonb NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL
);
```

```sql
CREATE TABLE workers (
    worker_pool_id text NOT NULL,
    worker_group text NOT NULL,
    worker_id text NOT NULL,
    provider_id text NOT NULL,
    created timestamp with time zone NOT NULL,
    expires timestamp with time zone NOT NULL,
    state text NOT NULL,
    provider_data jsonb NOT NULL,
    capacity integer NOT NULL,
    last_modified timestamp with time zone NOT NULL,
    last_checked timestamp with time zone NOT NULL,
    etag uuid DEFAULT public.gen_random_uuid() NOT NULL,
    secret jsonb
);
```

```sql
ALTER TABLE access_tokens
    ADD CONSTRAINT access_tokens_pkey PRIMARY KEY (hashed_access_token);
```

```sql
ALTER TABLE authorization_codes
    ADD CONSTRAINT authorization_codes_pkey PRIMARY KEY (code);
```

```sql
ALTER TABLE azure_queue_messages
    ADD CONSTRAINT azure_queue_messages_pkey PRIMARY KEY (message_id);
```

```sql
ALTER TABLE cache_purges
    ADD CONSTRAINT cache_purges_pkey PRIMARY KEY (provisioner_id, worker_type, cache_name);
```

```sql
ALTER TABLE clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (client_id);
```

```sql
ALTER TABLE denylisted_notifications
    ADD CONSTRAINT denylisted_notifications_pkey PRIMARY KEY (notification_type, notification_address);
```

```sql
ALTER TABLE github_access_tokens
    ADD CONSTRAINT github_access_tokens_pkey PRIMARY KEY (user_id);
```

```sql
ALTER TABLE github_builds
    ADD CONSTRAINT github_builds_pkey PRIMARY KEY (task_group_id);
```

```sql
ALTER TABLE github_checks
    ADD CONSTRAINT github_checks_pkey PRIMARY KEY (task_group_id, task_id);
```

```sql
ALTER TABLE github_integrations
    ADD CONSTRAINT github_integrations_pkey PRIMARY KEY (owner);
```

```sql
ALTER TABLE hooks_last_fires
    ADD CONSTRAINT hooks_last_fires_pkey PRIMARY KEY (hook_group_id, hook_id, task_id);
```

```sql
ALTER TABLE hooks
    ADD CONSTRAINT hooks_pkey PRIMARY KEY (hook_group_id, hook_id);
```

```sql
ALTER TABLE hooks_queues
    ADD CONSTRAINT hooks_queues_pkey PRIMARY KEY (hook_group_id, hook_id);
```

```sql
ALTER TABLE index_namespaces
    ADD CONSTRAINT index_namespaces_pkey PRIMARY KEY (parent, name);
```

```sql
ALTER TABLE indexed_tasks
    ADD CONSTRAINT indexed_tasks_pkey PRIMARY KEY (namespace, name);
```

```sql
ALTER TABLE queue_artifacts
    ADD CONSTRAINT queue_artifacts_pkey PRIMARY KEY (task_id, run_id, name);
```

```sql
ALTER TABLE queue_provisioner_entities
    ADD CONSTRAINT queue_provisioner_entities_pkey PRIMARY KEY (partition_key, row_key);
```

```sql
ALTER TABLE queue_worker_entities
    ADD CONSTRAINT queue_worker_entities_pkey PRIMARY KEY (partition_key, row_key);
```

```sql
ALTER TABLE queue_worker_type_entities
    ADD CONSTRAINT queue_worker_type_entities_pkey PRIMARY KEY (partition_key, row_key);
```

```sql
ALTER TABLE roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);
```

```sql
ALTER TABLE secrets_entities
    ADD CONSTRAINT secrets_entities_pkey PRIMARY KEY (partition_key, row_key);
```

```sql
ALTER TABLE sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (hashed_session_id);
```

```sql
ALTER TABLE task_dependencies
    ADD CONSTRAINT task_dependencies_pkey PRIMARY KEY (required_task_id, dependent_task_id);
```

```sql
ALTER TABLE task_groups
    ADD CONSTRAINT task_groups_pkey PRIMARY KEY (task_group_id);
```

```sql
ALTER TABLE tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (task_id);
```

```sql
ALTER TABLE worker_pool_errors
    ADD CONSTRAINT worker_pool_errors_pkey PRIMARY KEY (error_id);
```

```sql
ALTER TABLE worker_pools
    ADD CONSTRAINT worker_pools_pkey PRIMARY KEY (worker_pool_id);
```

```sql
ALTER TABLE workers
    ADD CONSTRAINT workers_pkey PRIMARY KEY (worker_pool_id, worker_group, worker_id);
```

```sql
CREATE INDEX azure_queue_messages_inserted ON public.azure_queue_messages USING btree (queue_name, inserted);
```

```sql
CREATE INDEX github_builds_organization_repository_sha_idx ON public.github_builds USING btree (organization, repository, sha);
```

```sql
CREATE INDEX github_checks_check_suite_id_check_run_id_idx ON public.github_checks USING btree (check_suite_id, check_run_id);
```

```sql
CREATE INDEX sha512_index_namespaces_idx ON public.index_namespaces USING btree (public.sha512(parent), name);
```

```sql
CREATE INDEX sha512_indexed_tasks_idx ON public.indexed_tasks USING btree (public.sha512(namespace), name);
```

```sql
CREATE INDEX task_dependencies_dependent_task_id_idx ON public.task_dependencies USING btree (dependent_task_id) WHERE (NOT satisfied);
```

```sql
CREATE INDEX tasks_task_group_id_idx ON public.tasks USING btree (task_group_id);
```

```sql
CREATE INDEX tasks_task_group_id_unresolved_idx ON public.tasks USING btree (task_group_id) WHERE (NOT ever_resolved);
```

```sql
CREATE INDEX worker_pool_errors_reported_idx ON public.worker_pool_errors USING btree (reported);
```