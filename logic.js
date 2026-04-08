document.addEventListener("DOMContentLoaded", () => {
        const config = Object.assign({
            dialogflowOauthClientId: "142373140699-kagadfn847u6ortgac7r9jahm126997v.apps.googleusercontent.com",
            feedbackOauthClientId: "142373140699-tnldg3nu62udoenkne5uigj9nclhb3a7.apps.googleusercontent.com",
            feedbackApiUrl: "https://educyber-feedback-api-142373140699.us-central1.run.app/submit-feedback"
        }, window.EDUCYBER_CONFIG || {});

        const launchBtn = document.getElementById("launch-chatbot");
        const closeBtn = document.getElementById("close-chatbot");
        const submitBtn = document.getElementById("submit-feedback");
        let chatbot = document.querySelector("df-messenger");
        const feedbackOverlay = document.getElementById("feedbackOverlay");
        const closeFeedbackBtn = document.getElementById("close-feedback");
        const authStatus = document.getElementById("auth-status");
        const googleSignin = document.getElementById("google-signin");
        const signOutBtn = document.getElementById("sign-out");
        const initialChatbotMarkup = chatbot.outerHTML;

        let googleIdToken = sessionStorage.getItem("educyberGoogleIdToken");
        let authProfile = null;
        let sessionId = createSessionId();
        let launchAfterSignIn = false;

        function isConfigured(value) {
            return Boolean(value) && !value.startsWith("REPLACE_WITH_");
        }

        function decodeJwtPayload(token) {
            const payload = token.split(".")[1];
            const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
            return JSON.parse(atob(normalized));
        }

        function isTokenExpired(token, skewSeconds = 60) {
            if (!token) return true;

            try {
                const payload = decodeJwtPayload(token);
                const now = Math.floor(Date.now() / 1000);
                return !payload.exp || payload.exp <= now + skewSeconds;
            } catch (error) {
                console.error("Unable to inspect token expiry:", error);
                return true;
            }   
        }


        function updateLaunchAvailability() {
            launchBtn.disabled = !isConfigured(config.dialogflowOauthClientId);
        }

        function setSignedOutState(message) {
            googleIdToken = null;
            authProfile = null;
            sessionStorage.removeItem("educyberGoogleIdToken");
            authStatus.textContent = message;
            signOutBtn.style.display = "none";
            updateLaunchAvailability();
        }

        function setSignedInState(profile, token) {
            googleIdToken = token;
            authProfile = profile;
            sessionStorage.setItem("educyberGoogleIdToken", token);
            authStatus.textContent = `Signed in as ${profile.email || "verified Google user"}.`;
            signOutBtn.style.display = "inline-block";
            updateLaunchAvailability();
        }

        window.initializeGoogleSignIn = function () {
            if (!isConfigured(config.feedbackOauthClientId)) {
                setSignedOutState("Add your frontend Google OAuth client ID in index.html before testing sign-in.");
                return;
            }

            if (!window.google || !window.google.accounts || !window.google.accounts.id) {
                setSignedOutState("Google Identity Services did not load. Refresh and try again.");
                return;
            }

            window.google.accounts.id.initialize({
                client_id: config.feedbackOauthClientId,
                callback: ({ credential }) => {
                    try {
                        const profile = decodeJwtPayload(credential);
                        setSignedInState(profile, credential);

                        if (launchAfterSignIn) {
                            launchAfterSignIn = false;
                            openChatbot();
                        }
                    } catch (error) {
                        console.error("Google sign-in failed:", error);
                        setSignedOutState("Google sign-in completed, but the ID token could not be processed.");
                    }
                }
            });

            googleSignin.innerHTML = "";
            window.google.accounts.id.renderButton(googleSignin, {
                theme: "outline",
                size: "large",
                shape: "pill",
                text: "signin_with",
                width: 280
            });
        }

        function syncMessengerAuthConfig() {
            if (!isConfigured(config.dialogflowOauthClientId)) {
                setSignedOutState("Add your Dialogflow Messenger OAuth client ID in index.html before testing the authenticated chat.");
                return;
            }

            chatbot.setAttribute("oauth-client-id", config.dialogflowOauthClientId);

            if (googleIdToken) {
                try {
                    authProfile = decodeJwtPayload(googleIdToken);
                    setSignedInState(authProfile, googleIdToken);
                } catch (error) {
                    console.error("Saved Google session could not be restored:", error);
                    setSignedOutState("Please sign in again to continue.");
                }
            } else {
                updateLaunchAvailability();
            }
        }

        function createSessionId() {
            return "user-" + crypto.randomUUID();
        }

        function resetChatbotSession() {
            const freshChatbot = document.createElement("div");
            freshChatbot.innerHTML = initialChatbotMarkup.trim();
            chatbot.replaceWith(freshChatbot.firstElementChild);
            chatbot = document.querySelector("df-messenger");
            chatbot.style.display = "none";
            sessionId = createSessionId();
            syncMessengerAuthConfig();
        }

        function openChatbot() {
            chatbot.style.display = "block";
            closeBtn.style.display = "block";
        }

        function closeChatSession() {
            chatbot.style.display = "none";
            closeBtn.style.display = "none";
            openFeedbackForm();
            resetChatbotSession();
        }

        window.addEventListener("df-chat-open-changed", (event) => {
            if (!event.detail || !event.detail.isOpen) {
                closeChatSession();
            }
        });

        launchBtn.addEventListener("click", () => {
            if (!googleIdToken) {
                if (window.google && window.google.accounts && window.google.accounts.id) {
                    launchAfterSignIn = true;
                    window.google.accounts.id.prompt();
                    authStatus.textContent = "Please complete Google sign-in to launch the chatbot.";
                } else {
                    alert("Google signin is loading. Please try again.");
                }
                return;
            }

            if (isTokenExpired(googleIdToken)) {
                alert("Your Google sign-in expired. Please sign in again before launching the chatbot.");
                setSignedOutState("Your session expired. Please sign in again.");
                return;
            }

            openChatbot();
        });

        closeBtn.addEventListener("click", () => {
            const confirmClose = confirm("Are you sure you want to close the chat?");

            if (confirmClose) {
                window.dispatchEvent(new CustomEvent("df-chat-open-changed", {
                    detail: { isOpen: false }
                }));
            }
        });

        function openFeedbackForm() {
            feedbackOverlay.classList.add("active");
            feedbackOverlay.setAttribute("aria-hidden", "false");
        }

        function closeFeedbackForm() {
            feedbackOverlay.classList.remove("active");
            feedbackOverlay.setAttribute("aria-hidden", "true");
        }

        function resetFeedbackForm() {
            document.getElementById("helpfulnessScore").value = "1";
            document.getElementById("guidanceStyle").value = "Yes";
            document.getElementById("comment").value = "";
        }

        closeFeedbackBtn.addEventListener("click", () => {
            closeFeedbackForm();
            resetFeedbackForm();
        });

        feedbackOverlay.addEventListener("click", (event) => {
            if (event.target === feedbackOverlay) {
                closeFeedbackForm();
                resetFeedbackForm();
            }
        });

        async function submitFeedback() {
            if (!googleIdToken) {
                alert("Please sign in with Google before submitting feedback.");
                return;
            }

            if (isTokenExpired(googleIdToken)) {
                alert("Your Google sign-in expired. Please sign in again before submitting feedback.");
                setSignedOutState("Your session expired. Please sign in again.");
                return;
            }

            const payload = {
                session_id: sessionId,
                helpfulness_score: parseInt(document.getElementById("helpfulnessScore").value, 10),
                guidance_style: document.getElementById("guidanceStyle").value.toLowerCase() === "neutral" ? "neutral" : document.getElementById("guidanceStyle").value,
                comment: document.getElementById("comment").value,
                page_url: window.location.href,
                form_version: "v2-authenticated",
                auth_status: "signed_in",
                auth_provider: "google"
            };

            try {
                const response = await fetch(config.feedbackApiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${googleIdToken}`
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || "Feedback submission failed");
                }

                console.log("Feedback submitted:", result);
                alert("Thanks! Your feedback was submitted successfully.");
                closeFeedbackForm();
                resetFeedbackForm();
                
            } catch (error) {
                console.error("Feedback submission failed:", error);
                alert("Feedback could not be submitted. Check the browser console or backend logs for details.");
            }
        }

        submitBtn.addEventListener("click", submitFeedback);

        signOutBtn.addEventListener("click", () => {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                window.google.accounts.id.disableAutoSelect();
            }

            setSignedOutState("Signed out. Sign in again to launch the chatbot.");
        });

        syncMessengerAuthConfig();

        function waitForGoogleIdentity(retries = 40, delay = 250) {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                window.initializeGoogleSignIn();
                return;
            }

            if (retries <= 0) {
                setSignedOutState("Google Identity Services did not load. Refresh and try again.");
                return;
            }

            window.setTimeout(() => waitForGoogleIdentity(retries - 1, delay), delay);
        }

        waitForGoogleIdentity();
    });
