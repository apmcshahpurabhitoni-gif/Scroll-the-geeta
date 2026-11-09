package com.scrollthegeeta.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

data class VersePage(
    val chapter: Int,
    val verse: Int,
    val chapterName: String,
    val chapterNameEnglish: String,
    val sanskrit: String,
    val transliteration: String,
    val translation: String,
    val translator: String
) {
    val reference: String get() = "$chapter.$verse"
}

sealed interface ScriptureLoadResult {
    data class Ready(val verses: List<VersePage>) : ScriptureLoadResult
    data class Failed(val reason: String) : ScriptureLoadResult
}

class ScriptureRepository {
    fun load(context: Context): ScriptureLoadResult = try {
        val assets = context.assets
        val manifestBytes = assets.open("scripture/manifest.json").use { it.readBytes() }
        val manifest = JSONObject(manifestBytes.toString(Charsets.UTF_8))
        val fileRecords = manifest.getJSONArray("files")
        val verified = mutableMapOf<String, ByteArray>()

        for (index in 0 until fileRecords.length()) {
            val record = fileRecords.getJSONObject(index)
            val path = record.getString("path")
            val bytes = assets.open("scripture/$path").use { it.readBytes() }
            val actual = sha256(bytes)
            val expected = record.getString("sha256")
            require(actual == expected) { "Integrity check failed for $path" }
            verified[path] = bytes
        }

        val versesRoot = JSONObject(verified.required("verses.json").toString(Charsets.UTF_8))
        val chapters = versesRoot.getJSONArray("chapters")
        val chapterByNumber = (0 until chapters.length()).associate { index ->
            val chapter = chapters.getJSONObject(index)
            chapter.getInt("n") to Pair(chapter.getString("name"), chapter.getString("nameEn"))
        }
        val verseRows = versesRoot.getJSONArray("verses")
        require(verseRows.length() == 701) { "Expected 701 verses; found ${verseRows.length()}" }

        // Keep the web app's current default English translation and attribution.
        val translatorIndex = JSONArray(verified.required("translations/index.json").toString(Charsets.UTF_8))
        val translator = (0 until translatorIndex.length())
            .map { translatorIndex.getJSONObject(it) }
            .firstOrNull { it.optString("slug") == "sivananda" }
            ?: error("Default translator sivananda is missing")
        val translationBytes = verified.required("translations/sivananda.json")
        val translations = JSONArray(translationBytes.toString(Charsets.UTF_8))
        require(translations.length() == verseRows.length()) {
            "Translation and verse arrays are not aligned"
        }

        val result = ArrayList<VersePage>(verseRows.length())
        for (index in 0 until verseRows.length()) {
            val verse = verseRows.getJSONObject(index)
            val chapterNumber = verse.getInt("ch")
            val chapterNames = chapterByNumber[chapterNumber]
                ?: error("Missing chapter metadata for $chapterNumber")
            val translated = translations.optString(index)
            require(translated.isNotBlank()) { "Missing translation at index $index" }
            result += VersePage(
                chapter = chapterNumber,
                verse = verse.getInt("v"),
                chapterName = chapterNames.first,
                chapterNameEnglish = chapterNames.second,
                sanskrit = verse.getString("sk"),
                transliteration = verse.getString("tr"),
                translation = translated,
                translator = translator.getString("author")
            )
        }
        ScriptureLoadResult.Ready(result)
    } catch (error: Exception) {
        ScriptureLoadResult.Failed(
            error.message ?: "The Scripture bundle could not be loaded."
        )
    }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256")
            .digest(bytes)
            .joinToString("") { byte -> "%02x".format(byte) }

    private fun Map<String, ByteArray>.required(path: String): ByteArray =
        this[path] ?: error("Missing content asset: $path")
}
