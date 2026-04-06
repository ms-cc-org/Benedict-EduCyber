# Benedict-EduCyber

## Overview

This repository supports the pilot deployment of an AI tutoring chatbot for students at Benedict College under the Minority Serving – Cyberinfrastructure Consortium (MS-CC) initiative.

The pilot has two primary objectives:

1. Deploy a working AI tutoring chatbot that:
   - Serves as a Socratic instructional assistant  
   - Captures structured student feedback  
   - Logs interaction data for research purposes  

2. Establish a reusable MS-CC reference architecture that can be replicated across additional campuses.

This repository contains documentation and the GitHub Pages landing page used to deploy and describe the chatbot system.

## Target Audience

Initial deployment is intended for:

- Students of Benedict College (pilot phase)

Future phases may include:

- Faculty collaborators  
- Student researchers  
- MS-CC partner campuses

## High-Level Architecture

### User Flow

1. User accesses chatbot via a shared link  
2. User authenticates using Gmail (authentication only; not stored)  
3. Landing page loads (hosted on GitHub Pages)  
4. Dialogflow CX Messenger widget loads  
5. Student interacts with the chatbot  
6. When the chat closes, a JavaScript event triggers the feedback interface  
7. Feedback is submitted and stored in structured datasets

## Technical Architecture

### Frontend
- Landing page hosted on GitHub Pages  
- Embedded Dialogflow CX Messenger widget  
- JavaScript event listener triggers post-chat feedback form  

### Chatbot Layer
- Dialogflow CX Messenger Widget  
- Dialogflow CX Deterministic Flow Agent  

The agent uses structured flows to:
- Guide Socratic questioning  
- Capture interaction signals  
- Log conversational events  

### Feedback Interface
- Feedback UI hosted on Google Cloud Run  
- Triggered when chat session ends  
- Submits structured responses to BigQuery  

### Data Storage
- BigQuery dataset: Interaction Logs  
  - Prompts  
  - Responses  
  - Events  

- BigQuery dataset: Website Feedback Responses

## Authentication & Data Collection

This project is IRB-approved.

### Authentication
- Users authenticate via Google before launching the chatbot.  
- Dialogflow CX Messenger uses an OAuth web client for authenticated chat access.  
- The feedback API validates a Google ID token before accepting submissions.  
- Email addresses are **not stored** in project datasets.  
- A pseudonymous hash of the Google user subject is stored for research continuity.  

### Data Collection
The system collects:

- Chat interaction logs (prompts, responses, events)  
- Structured feedback during interaction  
- Post-interaction feedback responses  
- Event timestamps  

The project is designed to make collected datasets as anonymous as possible while preserving research utility.

## Repo Structure

/docs --> Architecture and governance documentation
/landing-page --> GitHub Pages site source
/architecture --> System diagrams

## Authenticated Deployment Notes

This repo now assumes:

- authenticated Dialogflow CX Messenger
- authenticated feedback submission
- pseudonymous research logging

### Frontend values to replace

Update the `config` object in `logic.js` or `window.EDUCYBER_CONFIG`:

- `googleOauthClientId`
  Use one shared OAuth 2.0 Client ID for both the website Google sign-in flow and Dialogflow CX Messenger Authorized API. Reusing the same client prevents users from being asked to verify twice.
- `feedbackApiUrl`
  Use the deployed Cloud Run feedback endpoint.

### Cloud Run environment variables

Set these on the feedback API service:

- `PROJECT_ID=ms-cc-benedict-college-chatbot`
- `DATASET_ID=EduCyber_draft1_logs`
- `TABLE_ID=EduCyber_draft1_logs_table`
- `GOOGLE_OAUTH_CLIENT_ID=<frontend sign-in OAuth client ID>`
- `ALLOWED_ORIGINS=<comma-separated frontend origins>`
- `PSEUDONYM_SALT=<random secret string>`

Example `ALLOWED_ORIGINS`:

```text
https://<your-github-username>.github.io,http://localhost:5500
```

### BigQuery fields required

Make sure the feedback table includes these additional columns:

- `auth_status` STRING
- `auth_provider` STRING
- `google_sub_hash` STRING
- `user_domain` STRING
- `identity_verified_at` TIMESTAMP or STRING

### Google Cloud setup summary

1. Configure the OAuth consent screen in Google Auth Platform.
2. Create one OAuth web client shared by the website sign-in flow and Dialogflow Messenger.
3. Add your GitHub Pages and localhost origins to that client.
4. Reconfigure Dialogflow CX Messenger to use Authorized API with the same client.
5. Grant pilot users `Dialogflow API Client` and `Service Usage Consumer`.
6. Deploy the updated feedback API with the environment variables above.


## License

MIT License
