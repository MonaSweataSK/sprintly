--
-- PostgreSQL database dump
--

\restrict xgbSWveoStUIxWbmqiP72NO37stxnjbLBSnQyKY5Rwm7D3nQfQR3dkzm3Id1nAf

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: sprintly
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
34019583-7f05-4ac1-a33d-1adc02f0fd2d	b4e0497804e46e0a0b0b8c31975b062152d551bac49c3c2e80932567b4085dcd	2026-10-31 12:08:51.414601+00	20261031000000_initial	\N	\N	2026-10-31 12:08:51.413401+00	1
ca21e67a-6589-4025-8580-9478faeb725e	4372b08738161c00e260bd0ced327aae44f85c37ab3061acaa8c8c098efb38ce	2026-10-31 13:00:11.440685+00	20261031060000_authentication	\N	\N	2026-10-31 13:00:11.432985+00	1
168850d8-62e5-4d84-b4ce-ece268c1ff8c	0705c2ce127b6a06ec5429d6e70de34c62a9c048243ec395ba54a6fa00195961	2026-11-01 06:30:15.778465+00	20261101063015_task_dependencies	\N	\N	2026-11-01 06:30:15.773065+00	1
e7f090a9-58b6-410f-912e-bbeac1808756	75de7a6a3714332b648f00fe3cdc7cf9a37ff59df4cdbccf39d2822acc27aed6	2026-10-31 16:43:14.226102+00	20261031164314_members_teams	\N	\N	2026-10-31 16:43:14.221247+00	1
54b9e211-b91b-48a5-ac58-460575fde9ff	6dbb88a4805d43c33ad2cb8031041e6ebf138c7ff38f23e2c8c7518eeaf563c5	2026-10-31 17:23:45.225458+00	20261031172345_sprint_management	\N	\N	2026-10-31 17:23:45.220429+00	1
4310a9a3-2c10-45d3-a1c4-5ce9a49df4de	fb2f83cf60c9eaa318522a9e4658389862d0995ec7aaa11cdbd3e37be5dba660	2026-11-01 06:34:39.521063+00	20261101063439_remove_dependency_sprint_link	\N	\N	2026-11-01 06:34:39.518725+00	1
9f304b93-216b-4adc-98c5-3aac71487894	e88d83242b828405593f26c6a784dd6f077b0bb2f92d57a57bb76eba0be72462	2026-10-31 17:45:36.011032+00	20261031174511_task_management	\N	\N	2026-10-31 17:45:36.005528+00	1
37099d18-244e-4356-92d7-af37a0afe7f7	3b98752c3def966a2bd2f787025f7c44652f2be70b2e029cbba0d341f8f09e22	2026-10-31 17:48:44.71689+00	20261031174844_task_schema_sync	\N	\N	2026-10-31 17:48:44.714698+00	1
b3bad4d0-1374-4d50-9212-b2d1c87d4821	1165b52b81ce61330a38eae2d8c2e6d43dc0ba3ab641b7b2284b491763b36c14	2026-11-01 07:37:56.585132+00	20261102000000_hard_delete_tasks	\N	\N	2026-11-01 07:37:56.581727+00	1
7f1ff563-4508-4a7c-9860-1d5f8094ee56	7629080d854f5d6fb7a9633010e396504cca549ae71659afbae1d3f93d6333cc	2026-10-31 17:49:39.488779+00	20261031174939_nullable_task_creator	\N	\N	2026-10-31 17:49:39.485212+00	1
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: sprintly
--

COPY public.users (id, name, email, role, is_active, created_at, updated_at) FROM stdin;
0a6aa7fb-eb60-4a48-8ee0-17d9d485e3ad	mona	monasweatask@gmail.com	ADMIN	t	2026-10-31 13:21:15.828+00	2026-10-31 13:21:15.828+00
e858dccf-49c5-4a73-bf72-2cf32a1e4db8	Elayaraman	elayaraman007@gmail.com	USER	t	2026-10-31 17:18:45.213+00	2026-10-31 17:18:45.213+00
cfb99887-a63a-4c45-969f-684526042942	ram	wd9952598098@gmail.com	USER	t	2026-11-01 14:30:37.899+00	2026-11-01 14:30:37.899+00
\.


--
-- Data for Name: otp_challenges; Type: TABLE DATA; Schema: public; Owner: sprintly
--

COPY public.otp_challenges (id, user_id, code_hash, expires_at, used_at, attempts, created_at) FROM stdin;
f823b60d-b78c-413e-9b79-091e8a531d55	0a6aa7fb-eb60-4a48-8ee0-17d9d485e3ad	492e740f9f692637a19445c62a83478293875e37fd46b68fc56543de9e8666dc	2026-10-31 13:40:02.287+00	2026-10-31 13:35:14.454+00	0	2026-10-31 13:35:02.298+00
ef2cf1b7-d057-4577-9c60-8ab0f88e783d	0a6aa7fb-eb60-4a48-8ee0-17d9d485e3ad	e6db66776780ca09d895aec5d57acf2bf64c6bde5caa0dbf348db8910c38859c	2026-10-31 17:12:04.395+00	2026-10-31 17:07:15.743+00	0	2026-10-31 17:07:04.4+00
95893379-eed3-4abf-93c5-837a005438ff	0a6aa7fb-eb60-4a48-8ee0-17d9d485e3ad	a4085095f167ce2e9c5088329fff3a90c17b9b03770e0a172b0d3436de289204	2026-10-31 17:22:58.761+00	2026-10-31 17:18:11.611+00	0	2026-10-31 17:17:58.771+00
070df13b-66b7-4cb6-9995-647125fcff32	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	0431f983826ec53d8a063ed2b32d113c0388510970f8b13a4ff46bcc02d949d4	2026-10-31 17:25:42.329+00	2026-10-31 17:20:56.511+00	0	2026-10-31 17:20:42.335+00
3a33b557-27b2-4581-aca6-ec2357747dd8	0a6aa7fb-eb60-4a48-8ee0-17d9d485e3ad	2fe2e5b9844228799cc9cbd885d7e3454227eb566160fb441e9be540e47cd34e	2026-11-01 14:30:40.546+00	2026-11-01 14:25:51.305+00	0	2026-11-01 14:25:40.556+00
d3b1c7a1-a492-4029-a51d-698f2b380108	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	7f09af5e7f1b7b3fceb7b5c79dddcc0bb56565a387ab8f37e27fe9c98e485427	2026-11-01 14:36:49.193+00	2026-11-01 14:32:08.452+00	0	2026-11-01 14:31:49.199+00
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: sprintly
--

COPY public.teams (id, name, description, created_at) FROM stdin;
886a7286-6636-4bf1-895d-94f004c02ffd	enterprise	\N	2026-10-31 17:20:07.598+00
4d85a257-def9-45c4-b41e-7b0775f9abfe	404	\N	2026-11-01 14:31:35.577+00
\.


--
-- Data for Name: sprints; Type: TABLE DATA; Schema: public; Owner: sprintly
--

COPY public.sprints (id, name, description, team_id, start_date, end_date, status, created_by, created_at, updated_at) FROM stdin;
5d16a379-34e9-4ca1-94d7-44cafc2c8d85	nov-sprint	\N	886a7286-6636-4bf1-895d-94f004c02ffd	2026-11-02	2026-11-16	PLANNED	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	2026-10-31 17:29:00.838+00	2026-11-01 14:39:09.296+00
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: sprintly
--

COPY public.tasks (id, task_key, title, description, assignee_id, sprint_id, start_date, end_date, status, created_by, created_at, updated_at) FROM stdin;
3874aa52-ff6e-4949-bfcc-126065adbc57	TASK-105	UI prd	\N	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	5d16a379-34e9-4ca1-94d7-44cafc2c8d85	2026-11-02	2026-11-04	DONE	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	2026-10-31 17:57:10.633+00	2026-11-01 07:23:13.735+00
1f4de2c5-df59-465a-80b9-726738d7b734	TASK-106	api teting	\N	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	5d16a379-34e9-4ca1-94d7-44cafc2c8d85	\N	\N	DONE	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	2026-11-01 06:22:18.405+00	2026-11-01 07:27:39.419+00
faaa3962-8092-4c99-80bf-a76d642c85d8	TASK-107	integration tetsing	\N	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	\N	\N	\N	IN_PROGRESS	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	2026-11-01 06:23:53.775+00	2026-11-01 14:34:30.271+00
f9b94f3f-9908-4202-b3e6-26a2207c4440	TASK-119	ui changes	blah balh	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	5d16a379-34e9-4ca1-94d7-44cafc2c8d85	\N	\N	DONE	0a6aa7fb-eb60-4a48-8ee0-17d9d485e3ad	2026-11-01 14:27:38.268+00	2026-11-01 14:35:11.556+00
4c99f00c-6087-43a1-9c42-4dd1ab3a43d9	TASK-104	api design	create designs \n/api\n/apii	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	5d16a379-34e9-4ca1-94d7-44cafc2c8d85	2026-11-03	2026-11-10	DONE	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	2026-10-31 17:56:00.769+00	2026-11-01 14:37:18.325+00
dfca5547-28d3-4dd5-b539-120268151d34	TASK-120	testing backend	\N	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	5d16a379-34e9-4ca1-94d7-44cafc2c8d85	\N	\N	DONE	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	2026-11-01 14:36:19.136+00	2026-11-01 14:37:53.297+00
4c951a9c-faf3-4dcb-938c-642413dcc450	TASK-121	design doc	\N	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	5d16a379-34e9-4ca1-94d7-44cafc2c8d85	\N	\N	TODO	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	2026-11-01 14:41:27.865+00	2026-11-01 14:41:27.865+00
f0e64ef0-a93c-4eb7-a3ef-2cd5d9ea1f1c	TASK-122	prerequisite for design doc	\N	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	5d16a379-34e9-4ca1-94d7-44cafc2c8d85	\N	\N	DONE	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	2026-11-01 14:41:40.546+00	2026-11-01 14:52:08.286+00
\.


--
-- Data for Name: task_dependencies; Type: TABLE DATA; Schema: public; Owner: sprintly
--

COPY public.task_dependencies (id, task_id, depends_on_task_id, created_at) FROM stdin;
442a0e2b-f8f9-455e-8876-ba81f84515ad	1f4de2c5-df59-465a-80b9-726738d7b734	3874aa52-ff6e-4949-bfcc-126065adbc57	2026-11-01 07:22:37.702+00
eedffd44-4a17-44cd-8e74-bcdb28bd27d7	faaa3962-8092-4c99-80bf-a76d642c85d8	f9b94f3f-9908-4202-b3e6-26a2207c4440	2026-11-01 14:33:09.876+00
e087ffd3-4b30-4515-ad02-185be615a9aa	dfca5547-28d3-4dd5-b539-120268151d34	4c99f00c-6087-43a1-9c42-4dd1ab3a43d9	2026-11-01 14:36:45.377+00
8662d3ee-9014-4db8-bd03-6491dd3fb053	4c951a9c-faf3-4dcb-938c-642413dcc450	f0e64ef0-a93c-4eb7-a3ef-2cd5d9ea1f1c	2026-11-01 14:44:49.66+00
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: sprintly
--

COPY public.team_members (id, team_id, user_id, created_at) FROM stdin;
b2cd3986-33b3-4cf1-bfab-0bf3e6133d94	886a7286-6636-4bf1-895d-94f004c02ffd	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	2026-10-31 17:20:07.6+00
dd252b9f-c8c2-4011-9a7d-5bf72df0d1f0	4d85a257-def9-45c4-b41e-7b0775f9abfe	cfb99887-a63a-4c45-969f-684526042942	2026-11-01 14:31:35.579+00
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: sprintly
--

COPY public.user_sessions (id, user_id, refresh_token_hash, created_at, last_active_at, expires_at, revoked_at) FROM stdin;
b8585cde-8ced-43ea-b150-e40512f611d3	0a6aa7fb-eb60-4a48-8ee0-17d9d485e3ad	9e6655a0b933db38b10462e46fcfbf12235fbd1a9da289499ba4f40a73fdc30e	2026-10-31 13:35:14.464+00	2026-10-31 17:01:46.277+00	2026-11-30 17:01:46.277+00	2026-10-31 17:03:23.024+00
c41d9773-9df1-4f73-81df-e9a85fc20bd8	0a6aa7fb-eb60-4a48-8ee0-17d9d485e3ad	2a3b6b370d2ba96b1f6142c7bacdbee608dbafabbd7d810c24436e9617221c11	2026-11-01 14:25:51.316+00	2026-11-01 14:31:35.591+00	2026-12-01 14:31:35.591+00	2026-11-01 14:31:43.668+00
bd9ef57f-57d5-4cf8-98a0-3db18ec0e01e	0a6aa7fb-eb60-4a48-8ee0-17d9d485e3ad	aa55ba97e515557a3d42b63c8fefde7f4dc656d3748874c33ed0db66dff864ed	2026-10-31 17:07:15.748+00	2026-10-31 17:11:19.579+00	2026-11-30 17:11:19.579+00	2026-10-31 17:11:27.858+00
9400cd55-ebcc-4de7-8454-5fa54fe1d4a4	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	90769307971f0e76c084004365b0cb8d1a9f15ea7569cceeae6406038d14564c	2026-10-31 17:20:56.516+00	2026-11-01 14:25:23.518+00	2026-12-01 14:25:23.518+00	2026-11-01 14:25:26.896+00
f8bce893-90fa-4a5e-8084-944646088e0c	0a6aa7fb-eb60-4a48-8ee0-17d9d485e3ad	e2dfa4a1a9eb6c5ebf6b8144913cdfe289e9ee91558a7e1098928c304790167b	2026-10-31 17:18:11.618+00	2026-10-31 17:20:07.606+00	2026-11-30 17:20:07.606+00	2026-10-31 17:20:39.124+00
73b1782a-44e6-46e2-89ec-f25cef8634da	e858dccf-49c5-4a73-bf72-2cf32a1e4db8	127bc6f23959ca9c7ac38643d5bb820f3a992ec6cecbe5300ad0340144acd577	2026-11-01 14:32:08.46+00	2026-11-01 14:57:57.329+00	2026-12-01 14:57:57.329+00	\N
\.


--
-- Name: task_key_seq; Type: SEQUENCE SET; Schema: public; Owner: sprintly
--

SELECT pg_catalog.setval('public.task_key_seq', 122, true);


--
-- PostgreSQL database dump complete
--

\unrestrict xgbSWveoStUIxWbmqiP72NO37stxnjbLBSnQyKY5Rwm7D3nQfQR3dkzm3Id1nAf

