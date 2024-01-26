## LCYTER

*You and your friend both watch lots of YouTube videos?
Have you ever wondered which channels you might both watch but never talked about? - Find out today!*

Inspired by the [LCM](https://en.wikipedia.org/wiki/Least_common_multiple) in math, the **Least Common YouTuber** (LCYTER) is defined as the smallest YouTuber (by subscriber count) two people have in common (i.e. are both subscribed to).

This tool offers an easy way to find out all the channels you share without revealing to them the ones you don't.

### Getting started

- **Visit the [website](https://lcyter.jmaximusix.de)**
- Sign in  with Google so your browser can access the **Youtube API** (*Note: since the app isn't verified by Google yet, there will be a warning screen*)
- Fetch your current subscription list
- Share a hashed list of your subscriptions with your friends. You can either upload it to the server or save them as a file and share them however you like. See [Privacy Statement](#privacy-statement) for more information on how your data is handled.
- Compare your data to your friends and find out about your common YouTube channels and LCYTER

### Privacy statement

- Honoring the principles of data minimalism, every effort has been made to ensure the collection of as little data as possible
- The server at no point gains access to your personal information or API Access Token. Everything regarding your (unencrypted) data happens and stays in your browser (using the [implicit Javascript OAuth Flow](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow))
- Should you choose to share your results via the server *(which is optional)* you upload a shuffled list (so the order doesn't reveal any information) of the (SHA-256) hashes of the YouTube Channel-Ids.
- Furthermore you can choose the identifier which is needed to access them. It's up to you whether you choose a randomly generated string of characters which can't be guessed or something more memorable. Anyone who knows your identifier can compare their hashes against yours.
- This means, when comparing your subscriptions to someone else's you can only ever see the channels you have in common. Note however, that while it is generally not possible to reverse the hashing algorithm, one could still compare them against a list of "guesses" to check whether you are subscribed to certain channels.
- All the code (client and server) is publicly available in this repository, so you can verify these claims for yourself \:-)
