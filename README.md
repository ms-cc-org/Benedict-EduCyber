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
- Users authenticate via Gmail.  
- Gmail authentication is used for session validation only.  
- Email addresses are **not stored** in project datasets.  

### Data Collection
The system collects:

- Chat interaction logs (prompts, responses, events)  
- Structured feedback during interaction  
- Post-interaction feedback responses  
- Event timestamps  

The project is designed to make collected datasets as anonymous as possible while preserving research utility.


## License

MIT License
