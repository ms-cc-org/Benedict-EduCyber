document.addEventListener("DOMContentLoaded", () => {
        const config = Object.assign({
            googleOauthClientId: "142373140699-kagadfn847u6ortgac7r9jahm126997v.apps.googleusercontent.com",
            dialogflowOauthClientId: "",
            feedbackOauthClientId: "",
            feedbackApiUrl: "https://educyber-feedback-api-142373140699.us-central1.run.app/submit-feedback"
        }, window.EDUCYBER_CONFIG || {});

        const launchBtn = document.getElementById("launch-chatbot");
        const closeBtn = document.getElementById("close-chatbot");
        const submitBtn = document.getElementById("submit-feedback");
        let chatbot = document.querySelector("df-messenger");
        const feedbackOverlay = document.getElementById("feedbackOverlay");
        const closeFeedbackBtn = document.getElementById("close-feedback");
        const authStatus = document.getElementById("auth-status");
        const authPanel = document.getElementById("auth-panel");
        const sessionPanel = document.getElementById("session-panel");
        const sessionStatus = document.getElementById("session-status");
        const googleSignin = document.getElementById("google-signin");
        const cancelSigninBtn = document.getElementById("cancel-signin");
        const signOutBtn = document.getElementById("sign-out");
        const initialChatbotMarkup = chatbot.outerHTML;
        const googleOauthClientId = config.googleOauthClientId || config.dialogflowOauthClientId || config.feedbackOauthClientId;

        let googleIdToken = sessionStorage.getItem("educyberGoogleIdToken");
        let authProfile = null;
        let sessionId = createSessionId();
        let pendingChatLaunch = false;
        let googleIdentityReady = false;

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
            launchBtn.disabled = !isConfigured(googleOauthClientId);
        }

        function hideSignInPrompt() {
            authPanel.hidden = true;
        }

        function showSignInPrompt(message = "Sign in with Google to launch the chatbot.") {
            authStatus.textContent = message;
            authPanel.hidden = false;
        }

        function setSignedOutState(message) {
            googleIdToken = null;
            authProfile = null;
            sessionStorage.removeItem("educyberGoogleIdToken");
            sessionPanel.hidden = true;
            showSignInPrompt(message);
            updateLaunchAvailability();
        }

        function setSignedInState(profile, token) {
            googleIdToken = token;
            authProfile = profile;
            sessionStorage.setItem("educyberGoogleIdToken", token);
            hideSignInPrompt();
            sessionStatus.textContent = `Signed in as ${profile.email || "verified Google user"}.`;
            sessionPanel.hidden = false;
            updateLaunchAvailability();
        }

        function openChatbot() {
            chatbot.style.display = "block";
            closeBtn.style.display = "block";
        }

        function beginLaunchFlow() {
            if (!isConfigured(googleOauthClientId)) {
                alert("Google sign-in is not configured yet.");
                return;
            }

            if (googleIdToken && !isTokenExpired(googleIdToken)) {
                openChatbot();
                return;
            }

            if (googleIdToken && isTokenExpired(googleIdToken)) {
                setSignedOutState("Your session expired. Sign in again to launch the chatbot.");
            }

            pendingChatLaunch = true;
            showSignInPrompt("Sign in once with Google and the chatbot will open automatically.");
            googleSignin.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        window.initializeGoogleSignIn = function () {
            if (!isConfigured(googleOauthClientId)) {
                setSignedOutState("Add one shared Google OAuth client ID before testing sign-in.");
                return;
            }

            if (!window.google || !window.google.accounts || !window.google.accounts.id) {
                setSignedOutState("Google Identity Services did not load. Refresh and try again.");
                return;
            }

            window.google.accounts.id.initialize({
                client_id: googleOauthClientId,
                callback: ({ credential }) => {
                    try {
                        const profile = decodeJwtPayload(credential);
                        setSignedInState(profile, credential);
                        if (pendingChatLaunch) {
                            pendingChatLaunch = false;
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
            googleIdentityReady = true;
        }

        function syncMessengerAuthConfig() {
            if (!isConfigured(googleOauthClientId)) {
                setSignedOutState("Add one shared Google OAuth client ID before testing the authenticated chat.");
                return;
            }

            chatbot.setAttribute("oauth-client-id", googleOauthClientId);

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
            if (!googleIdentityReady) {
                alert("Google sign-in is still loading. Please try again in a moment.");
                return;
            }

            beginLaunchFlow();
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

            pendingChatLaunch = false;
            setSignedOutState("Signed out. Select Launch Chatbot to sign in again.");
        });

        cancelSigninBtn.addEventListener("click", () => {
            pendingChatLaunch = false;
            hideSignInPrompt();
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
