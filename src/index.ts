#!/usr/bin/env node

import fetch from "node-fetch";
import * as cheerio from "cheerio";
import * as urlParser from "url";
import * as fs from "fs/promises";

interface SeenUrls {
  [url: string]: boolean;
}

interface ImageResult {
  imageUrl: string;
  sourceUrl: string;
  depth: number;
}

const seenUrls: SeenUrls = {};
const results: ImageResult[] = []; 

const getUrl = (link: string, host: string, protocol: string): string => {
  if (link.includes("http")) {
    return link;
  } else if (link.startsWith("/")) {
    return `${protocol}//${host}${link}`;
  } else {
    return `${protocol}//${host}/${link}`;
  }
};

const crawl = async ({
  url,
  ignore,
  depth,
}: {
  url: string;
  ignore: string;
  depth: number;
}) => {
  if (seenUrls[url]) return;
  console.log("Crawling", url);
  seenUrls[url] = true;

  const parsedUrl = urlParser.parse(url);
  const host: string | null = parsedUrl.hostname;
  const protocol: string | null = parsedUrl.protocol;

  if (!host || !protocol) {
    console.error("Invalid URL:", url);
    return;
  }

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const links: string[] = $("a")
      .map((i, link) => link.attribs.href)
      .get() as string[];

    const imageUrls: string[] = $("img")
      .map((i, link) => link.attribs.src)
      .get() as string[];

    imageUrls.forEach((imageUrl) => {
      results.push({
        imageUrl: imageUrl,
        sourceUrl: url,
        depth: depth,
      });
    });

    if (depth <= 0) return;

    await Promise.all(
      links
        .filter((link) => link.includes(host) && !link.includes(ignore))
        .map(async (link) => {
          await crawl({
            url: getUrl(link, host, protocol),
            ignore,
            depth: depth - 1,
          });
        })
    );
  } catch (error) {
    console.error("Error crawling URL:", error);
  }
};

const [, , startUrl, depth] = process.argv;

if (startUrl && depth) {
  crawl({ url: startUrl, ignore: "/search", depth: parseInt(depth, 10) })
    .then(() => {
      const jsonResults = JSON.stringify({ results }, null, 2);
      fs.writeFile("results.json", jsonResults, "utf8")
        .then(() => {
          console.log("Results saved to results.json");
        })
        .catch((error) => {
          console.error("Error writing results to file:", error);
        });
    })
    .catch((error) => {
      console.error("Error during crawling:", error);
    });
} 
