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

## Implemented on `feature/full-admin-panel`

- Versioned taxonomy: `assets/dumc/taxonomy.json`, 12 top-level sections and 226 stable folder IDs.
- Additive D1 migration: `migrations/0009_dumc_movie_library.sql`. It creates folder, canonical movie metadata, many-to-many classification, audio-track reference and subtitle-reference tables; seeds the taxonomy; and backfills one metadata row per existing video without guessing missing metadata.
- Authenticated Owner/Admin APIs: `GET/POST /api/admin/dumc/folders`, `PATCH/DELETE /api/admin/dumc/folders/:id`, `GET /api/admin/dumc/movies`, `GET/PUT /api/admin/dumc/movies/:videoId`, `PUT /api/admin/dumc/movies/:videoId/folders`, and audio/subtitle reference creation/deletion routes.
- Upload Studio includes a searchable folder explorer, custom-folder creation, movie metadata editor, multi-select Genre/Dubbed/Subtitle/Collection classification, audio/subtitle reference registration, and optional folder assignment when creating a video.
- The migration inventory is updated. A dedicated GitHub Actions workflow runs SQLite migration tests, migration-inventory validation and JavaScript syntax checks.

## Important execution boundary

The migration file is committed but has **not** been applied to any D1 database. The repository manifest is documentation-only; Wrangler migrations are not configured and it does not identify applied database history. The Upload Studio falls back to the static taxonomy until the D1 schema is installed. No Preview or Production deployment has been performed.

Audio/subtitle APIs register references to an existing `movies/...` asset key or an external HTTPS URL. They do not upload media bytes; a dedicated DUMC media bucket binding and upload pipeline still need to be configured and tested. No external asset is fetched by the API.


## Public homepage integration and media policy

- The homepage now has a dedicated DUMC movie-browsing section with public-facing navigation for language, film industry, dubbed movies, genres, countries, collections and subtitles; nested folders are selectable and movies are shown as responsive cover cards.
- Public browsing uses `GET /api/dumc/browse`, which returns published movies only and supports recursive folder filtering, server-side search and pagination.
- **Media policy:** movie/video files are never uploaded to this website, regardless of whether they are 50 MB, 100 MB or another size. Movie playback uses external video links. Only cover/poster images may be uploaded. Audio and subtitle references are HTTPS links only; DUMC APIs reject asset-key based media registration.
- DUMC homepage integration is committed to the feature branch but is not live until the D1 migration is applied and the branch is deployed.
