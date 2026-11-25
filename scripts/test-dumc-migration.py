#!/usr/bin/env python3
"""DUMC migration integration tests against SQLite's compatible SQL engine."""
from pathlib import Path
import json
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0009_dumc_movie_library.sql"
TAXONOMY = ROOT / "assets" / "dumc" / "taxonomy.json"


class DumcMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.taxonomy = json.loads(TAXONOMY.read_text(encoding="utf-8"))
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.db = sqlite3.connect(":memory:")
        cls.db.execute("PRAGMA foreign_keys=ON")
        cls.db.executescript("""
            CREATE TABLE users(id TEXT PRIMARY KEY);
            CREATE TABLE videos(id TEXT PRIMARY KEY, title TEXT NOT NULL);
            INSERT INTO users(id) VALUES ('owner-1');
            INSERT INTO videos(id,title) VALUES ('movie-1','Sample Movie'),('movie-2','Unclassified Movie');
        """)
        cls.db.executescript(cls.sql)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_api_routes_are_behind_admin_authentication(self):
        api = (ROOT / "functions" / "api" / "[[path]].js").read_text(encoding="utf-8")
        auth_gate = api.index('const user=await getSession(req,env);if(!user||!["owner","admin"].includes(user.role))')
        dumc_routes = api.index('if(p[0]==="admin"&&p[1]==="dumc")')
        self.assertLess(auth_gate, dumc_routes)
        for marker in ('p[2]==="folders"', 'p[2]==="movies"', '"dubbed_language"', '"subtitle_language"'):
            self.assertIn(marker, api)

    def test_public_homepage_browse_is_read_only_and_link_based(self):
        api = (ROOT / "functions" / "api" / "[[path]].js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        home = (ROOT / "assets" / "dumc" / "home.js").read_text(encoding="utf-8")
        self.assertIn('p[0]==="dumc"&&p[1]==="browse"', api)
        self.assertIn('id="movies"', html)
        self.assertIn('/assets/dumc/home.js?v=dumc-home-01', html)
        self.assertIn('/assets/dumc/home.css?v=dumc-home-01', html)
        self.assertIn('params.set("folder_id",activeFolder)', home)
        self.assertIn('params.set("q",query)', home)
        self.assertIn("loadTaxonomyFallback", home)
        self.assertIn('Provide an HTTPS audio source URL', api)
        self.assertIn('Provide an HTTPS subtitle source URL', api)
        self.assertNotIn('asset_key=reference', (ROOT / "dumc-manager.js").read_text(encoding="utf-8"))

    def test_upload_studio_loads_the_interactive_manager(self):
        html = (ROOT / "upload-studio.html").read_text(encoding="utf-8")
        manager = (ROOT / "dumc-manager.js").read_text(encoding="utf-8")
        upload = (ROOT / "upload-studio.js").read_text(encoding="utf-8")
        self.assertIn("dumc-manager.js?v=dumc-02", html)
        self.assertIn("window.DUMCLinkFolder", manager)
        self.assertIn("DUMCLinkFolder(created.id", upload)

    def test_seed_matches_versioned_taxonomy(self):
        expected = []
        def walk(node, parent=None):
            expected.append((node["id"], parent))
            for child in node.get("children", []):
                walk(child, node["id"])
        walk(self.taxonomy)
        actual = self.db.execute(
            "SELECT id,parent_id FROM dumc_folders ORDER BY id"
        ).fetchall()
        self.assertEqual(len(expected), 226)
        self.assertEqual(len(actual), len(expected))
        self.assertEqual(set(actual), set(expected))
        self.assertEqual(self.db.execute(
            "SELECT COUNT(DISTINCT id) FROM dumc_folders"
        ).fetchone()[0], 226)

    def test_existing_videos_are_backfilled_without_guessing(self):
        rows = self.db.execute(
            "SELECT video_id,original_language_folder_id,industry_folder_id,"
            "production_country_folder_id,release_year,metadata_json FROM dumc_movies"
        ).fetchall()
        self.assertEqual(len(rows), 2)
        for row in rows:
            self.assertEqual(row[1:5], (None, None, None, None))
            self.assertEqual(json.loads(row[5]), {})

    def test_movie_folder_relationship_supports_multiple_dimensions(self):
        self.db.execute(
            "INSERT INTO dumc_movie_folder_assignments VALUES(?,?,?,?,?)",
            ("movie-1","GENRE_ACTION","genre","owner-1",1),
        )
        self.db.execute(
            "INSERT INTO dumc_movie_folder_assignments VALUES(?,?,?,?,?)",
            ("movie-1","GENRE_THRILLER","genre","owner-1",1),
        )
        self.db.execute(
            "INSERT INTO dumc_movie_folder_assignments VALUES(?,?,?,?,?)",
            ("movie-1","DUB_HINDI_DUBBED","dubbed_language","owner-1",1),
        )
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM dumc_movie_folder_assignments WHERE video_id='movie-1'"
        ).fetchone()[0], 3)

    def test_duplicate_assignment_is_rejected(self):
        row = ("movie-2","GENRE_DRAMA","genre","owner-1",1)
        self.db.execute("INSERT INTO dumc_movie_folder_assignments VALUES(?,?,?,?,?)", row)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO dumc_movie_folder_assignments VALUES(?,?,?,?,?)", row)

    def test_invalid_release_year_and_orphan_folder_are_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE dumc_movies SET release_year=1700 WHERE video_id='movie-1'"
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO dumc_movie_folder_assignments VALUES(?,?,?,?,?)",
                ("movie-1","MISSING_FOLDER","genre","owner-1",1),
            )

    def test_audio_and_subtitle_assets_require_a_reference(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO dumc_audio_tracks(id,video_id,language_folder_id,track_type,created_at,updated_at) "
                "VALUES('a1','movie-1','LANG_HINDI','dubbed',1,1)"
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO dumc_subtitles(id,video_id,language_folder_id,created_at,updated_at) "
                "VALUES('s1','movie-1','SUBTITLE_BANGLA',1,1)"
            )
        self.db.execute(
            "INSERT INTO dumc_audio_tracks(id,video_id,language_folder_id,track_type,source_url,created_at,updated_at) "
            "VALUES('a2','movie-1','LANG_HINDI','dubbed','https://media.example/audio.aac',1,1)"
        )
        self.db.execute(
            "INSERT INTO dumc_subtitles(id,video_id,language_folder_id,source_url,created_at,updated_at) "
            "VALUES('s2','movie-1','SUBTITLE_BANGLA','https://media.example/subtitles/bn.srt',1,1)"
        )

    def test_video_delete_cascades_movie_relations_but_preserves_taxonomy(self):
        self.db.execute(
            "INSERT INTO dumc_movie_folder_assignments VALUES(?,?,?,?,?)",
            ("movie-1","GENRE_ACTION","genre","owner-1",1),
        )
        self.db.execute("DELETE FROM videos WHERE id='movie-1'")
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM dumc_movies WHERE video_id='movie-1'"
        ).fetchone()[0], 0)
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM dumc_movie_folder_assignments WHERE video_id='movie-1'"
        ).fetchone()[0], 0)
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM dumc_folders"
        ).fetchone()[0], 226)


if __name__ == "__main__":
    unittest.main(verbosity=2)
