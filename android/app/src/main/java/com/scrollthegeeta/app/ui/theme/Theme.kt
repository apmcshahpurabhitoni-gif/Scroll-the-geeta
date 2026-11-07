package com.scrollthegeeta.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Paper = Color(0xFFF7F3EA)
private val Ink = Color(0xFF29251F)
private val Terracotta = Color(0xFF9C4F38)
private val MutedInk = Color(0xFF6E6257)

private val ScrollColorScheme = lightColorScheme(
    primary = Terracotta,
    onPrimary = Color.White,
    secondary = MutedInk,
    background = Paper,
    onBackground = Ink,
    surface = Paper,
    onSurface = Ink
)

@Composable
fun ScrollTheGeetaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ScrollColorScheme,
        content = content
    )
}
