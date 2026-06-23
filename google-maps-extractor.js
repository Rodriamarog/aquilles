import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with your Apify API token
// Replace the '<YOUR_API_TOKEN>' with your token
const client = new ApifyClient({
    token: '<YOUR_API_TOKEN>',
});

// Prepare Actor input
const input = {
    "searchStringsArray": [
        "restaurant"
    ],
    "locationQuery": "New York, USA",
    "maxCrawledPlacesPerSearch": 50,
    "language": "en",
    "scrapeSocialMediaProfiles": {
        "facebooks": false,
        "instagrams": false,
        "youtubes": false,
        "tiktoks": false,
        "twitters": false
    },
    "maximumLeadsEnrichmentRecords": 0
};

// Run the Actor and wait for it to finish
const run = await client.actor("compass/crawler-google-places").call(input);

// Fetch and print Actor results from the run's dataset (if any)
console.log('Results from dataset');
console.log(`💾 Check your data here: https://console.apify.com/storage/datasets/${run.defaultDatasetId}`);
const { items } = await client.dataset(run.defaultDatasetId).listItems();
items.forEach((item) => {
    console.dir(item);
});

