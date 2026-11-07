package com.scrollthegeeta.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.scrollthegeeta.app.data.ScriptureLoadResult
import com.scrollthegeeta.app.data.ScriptureRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun ScrollTheGeetaApp() {
    val context = LocalContext.current
    var result by remember { mutableStateOf<ScriptureLoadResult?>(null) }

    LaunchedEffect(Unit) {
        result = withContext(Dispatchers.IO) {
            ScriptureRepository().load(context)
        }
    }

    when (val state = result) {
        null -> StatusColumn {
            CircularProgressIndicator()
            Text(
                modifier = Modifier.padding(top = 18.dp),
                text = "Preparing the Scripture library",
                style = MaterialTheme.typography.bodyMedium
            )
        }
        is ScriptureLoadResult.Ready -> ReaderScreen(state.verses)
        is ScriptureLoadResult.Failed -> StatusColumn {
            Text(
                text = "Scripture bundle not ready",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                modifier = Modifier.padding(top = 12.dp),
                text = state.reason,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center
            )
            Text(
                modifier = Modifier.padding(top = 20.dp),
                text = "Export the verified content bundle from the repository before launching the reader.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.secondary,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun StatusColumn(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
        content = content
    )
}
