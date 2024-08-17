"use client";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Container,
  Box,
  CardActionArea,
  DialogTitle,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import { db } from "../../firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  writeBatch,
} from "firebase/firestore";
import Navbar from "../components/NavBar";
import Stripe from "stripe";

export default function Generate() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [flashcards, setFlashcards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flipped, setFlipped] = useState([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [needsMoreInfo, setNeedsMoreInfo] = useState(false);
  const router = useRouter();
  const [suscription, setSuscription] = useState(false);

  const stripe = new Stripe(
    "sk_test_51PoZ1gA1Bes7OdcoHZ5Y1pfe3wOAlNVfdz9ziYGAwFKjXCvtMMPYSh5cmgoVUCUDCc5G8IJvOK99HdSdnMWzZ0VS00SaZlixMb",
    {
      apiVersion: "2024-06-20",
    }
  );

  const handleSubmit = async () => {
    setNeedsMoreInfo(false);
    setIsLoading(true);
    fetch("api/generate", {
      method: "POST",
      body: text,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.error == "I need more information.") {
          alert("I need more information");
          setNeedsMoreInfo(true);
          setText("");
          return;
        }
        setFlashcards(data);
      })
      .catch((error) => {
        console.error("Failed to generate flashcards:", error);
        alert("Failed to generate flashcards");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleCardClick = (id) => {
    setFlipped((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const checkSubscription = async (email) => {
    try {
      // Retrieve customer list by email
      console.log(" Checking subscription for email: ", email);
      const customers = await stripe.customers.list({
        email: email,
        limit: 1, // Assuming each email corresponds to a single customer
      });

      if (customers.data.length === 0) {
        console.log("No customer found with this email.");
        return;
      }

      const customerId = customers.data[0].id;
      console.log("Customer ID: ", customerId);

      // Check for active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
      });

      if (subscriptions.data.length > 0) {
        console.log("Subscription found: ", subscriptions.data[0]);
        localStorage.setItem("subscription", true);
        setSuscription(true);
      } else {
        console.log("No active subscription found.");
        localStorage.removeItem("subscription");
        setSuscription(false);
      }
    } catch (error) {
      console.error("Error checking subscription", error);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    checkSubscription(user.primaryEmailAddress.emailAddress);
  }, [user]);

  const saveFlashcards = async () => {
    if (!isSignedIn || !user) {
      alert("You must be signed in to save flashcards");
      return;
    }
    if (!name) {
      alert("Please enter a name");
      return;
    }

    const batch = writeBatch(db);
    const userDocRef = doc(collection(db, "users"), user.id);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const collections = docSnap.data().flashcards || [];

      // Check if the user already has 3 or more collections
      if (collections.length >= 3 && !suscription) {
        alert(
          "You already have 3 collections. Upgrade to Pro Plan to save more"
        );
        return;
      }

      console.log(" user ", user);
      // Check if a collection with the same name exists
      if (collections.find((f) => f.name === name)) {
        alert("Flashcard collection with the same name already exists");
        return;
      } else {
        collections.push({ name });
        batch.set(
          userDocRef,
          {
            flashcards: collections,
            email: user.primaryEmailAddress.emailAddress,
          },
          { merge: true }
        );
      }
    } else {
      batch.set(userDocRef, { flashcards: [{ name }], email: user.email });
    }

    const colRef = collection(userDocRef, name);
    flashcards.forEach((flashcard) => {
      const cardDocRef = doc(colRef);
      batch.set(cardDocRef, flashcard);
    });

    await batch.commit();
    console.log("Flashcards saved ", flashcards);
    handleClose();
    router.push("/flashcards");
  };

  return (
    <Container maxWidth="md">
      <Navbar />

      <Box
        sx={{
          mt: 4,
          mb: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography variant="h4"> Generate Flashcards</Typography>
        <Paper sx={{ p: 4, width: "100%" }}>
          {isLoading && (
            <CircularProgress
              size={80}
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1000,
              }}
            />
          )}
          <TextField
            value={text}
            onChange={(e) => setText(e.target.value)}
            label="enter text"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            sx={{
              mb: 2,
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            fullWidth
            disabled={flashcards.length > 0 || isLoading}
          >
            Submit
          </Button>

          {needsMoreInfo && (
            <Typography variant="h6" color="error">
              Please provide more information/context in the input.
            </Typography>
          )}
        </Paper>
      </Box>
      {flashcards.length > 0 && (
        <Box sm={{ mt: 4 }}>
          <Typography variant="h5">Flashcards Preview</Typography>
          <Grid container spacing={3}>
            {flashcards.map((flashcard, index) => {
              return (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card>
                    <CardActionArea
                      onClick={() => {
                        handleCardClick(index);
                      }}
                    >
                      <CardContent>
                        <Box
                          sx={{
                            perspective: "1000px",
                            "& > div": {
                              transition: "transform 0.6s",
                              transformStyle: "preserve-3d",
                              position: "relative",
                              width: "100%",
                              height: "200px",
                              boxShadow: "0 4px 8px 0 rgba(0,0,0,0.2)",
                              transform: flipped[index]
                                ? "rotateY(180deg)"
                                : "rotateY(0deg)",
                            },
                            "& > div > div": {
                              position: "absolute",
                              width: "100%",
                              height: "100%",
                              backfaceVisibility: "hidden",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              padding: 2,
                              boxSizing: "border-box",
                            },

                            "& > div > div:nth-of-type(2)": {
                              transform: "rotateY(180deg)",
                            },
                          }}
                        >
                          <div>
                            <div>
                              <Typography variant="h5" component="div">
                                {flashcard.front}
                              </Typography>
                            </div>
                            <div>
                              <Typography variant="h5" component="div">
                                {flashcard.back}
                              </Typography>
                            </div>
                          </div>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
          <Box
            sx={{
              my: 4,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Button variant="contained" color="secondary" onClick={handleOpen}>
              Save
            </Button>
          </Box>
        </Box>
      )}
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Save Flashcards</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please enter a name for your flashcards collection
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Collection Name"
            type="text"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}> Cancel</Button>
          <Button onClick={saveFlashcards}> Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
