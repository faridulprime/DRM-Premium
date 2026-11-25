# DUMC — DRM Universal Movie Section
Version: 1.0.0
Status: Taxonomy catalog and Upload Studio folder explorer implemented on `feature/full-admin-panel`; persistent folder/media relationships are not implemented.

## Purpose
DUMC provides one canonical classification model for the Movies section. It separates original audio language, film industry, dubbed audio, genre, production country, collections, release year, subtitle availability, artwork and metadata.

## Architecture
- Parent path: `Movies/DUMC`.
- Stable folder IDs are the identity; display labels can change.
- The taxonomy is a versioned JSON source at `assets/dumc/taxonomy.json`.
- Folder views are virtual classifications. A movie is stored once and can appear in multiple folders through metadata relationships.
- The taxonomy does not create duplicate media files or infer missing metadata.

## Top-level folders
- `00_SYSTEM`: README, TAXONOMY, SCHEMAS, CHANGELOG.
- `01_MOVIE_LIBRARY`: FEATURED, ALL_MOVIES, UNCLASSIFIED, ARCHIVED.
- `02_LANGUAGE`: Bangla, Hindi, English, Tamil, Telugu, Malayalam, Kannada, Marathi, Punjabi, Urdu, Korean, Japanese, Chinese, Spanish, French, Arabic, Turkish, Persian, German, Italian, Russian, Other_Languages.
- `03_FILM_INDUSTRY`: Dhallywood, Bengali_Cinema_India, Bollywood, Telugu_Cinema, Tamil_Cinema, Malayalam_Cinema, Kannada_Cinema, Hollywood, Marathi_Cinema, Punjabi_Cinema, Korean_Cinema, Japanese_Cinema, Chinese_Cinema, Other_Industries.
- `04_DUBBED_MOVIES`: Bangla_Dubbed, Hindi_Dubbed, English_Dubbed, Tamil_Dubbed, Telugu_Dubbed, Malayalam_Dubbed, Kannada_Dubbed, Urdu_Dubbed, Other_Dubbed.
- `05_GENRES`: Action, Adventure, Animation, Comedy, Crime, Drama, Documentary, Fantasy, Historical, Horror, Mystery, Romance, Science_Fiction, Thriller, War, Western, Musical, Family, Biography, Sports, Superhero, Psychological, Noir, Disaster, Music.
- `06_COUNTRIES`: Bangladesh, India, United_States, United_Kingdom, South_Korea, Japan, China, Hong_Kong, Taiwan, France, Germany, Italy, Spain, Turkey, Iran, Thailand, Indonesia, Malaysia, Australia, Canada, Other_Countries.
- `07_COLLECTIONS`: Movie_Franchises, Movie_Series, Cinematic_Universe, Sequels, Prequels, Standalone_Collections, Award_Winners, DRM_Editor_Picks.
- `08_RELEASE_YEARS`: decades 2020s through 1960s, Before_1960, Unknown_Year; decade folders contain year folders.
- `09_SUBTITLES`: Bangla, English, Hindi, Arabic, Spanish, French, Other_Subtitles.
- `10_ARTWORK`: Posters, Backdrops, Logos, Stills, Trailers_Thumbnails, Promotional_Artwork.
- `11_METADATA`: Movie_Records, People_Cast_Crew, Studios_Production, Ratings_Reviews, External_Identifiers, Metadata_Import_Queue, Missing_Metadata, Duplicate_Review_Queue.

## Classification rules
1. Original audio language is not the same as dubbed audio language.
2. Industry, country, language and genre are independent fields.
3. Multiple values are allowed for dubbed languages, genres, countries, subtitles and collections where evidence supports them.
4. Unknown values remain unknown; no automatic guessing.
5. One canonical movie record and media identity; virtual folders do not duplicate files.
6. Stable IDs are used for future API/database relationships.

## Implementation boundary
The current application stores videos with one category string and has no folder table, folder API, movie metadata model, or many-to-many media relationships. The current release therefore provides a browsable, versioned taxonomy catalog only. The Upload Studio folder picker remains disabled to avoid pretending that a selected folder is persisted.

Persistent folders, folder assignment, original/dubbed audio variants, subtitle assets and movie records require a reviewed D1 migration and authenticated Owner/Admin API. No migration or database write is included in this commit.
