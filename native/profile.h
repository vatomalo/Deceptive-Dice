static int profiling;
static Uint64 profile_native[6], profile_calls[6];
static double profile_step_ms, profile_present_ms;
static void profile_record(const char *op, Uint64 start) {
    if (!profiling) return;
    int category = (!strcmp(op,"draw")||!strcmp(op,"sprite-draw")||!strcmp(op,"character-draw")) ? 0 : !strcmp(op,"text") || !strcmp(op,"measure") ? 1 :
        !strcmp(op,"fill") || !strcmp(op,"stroke") || !strcmp(op,"rect") ? 2 :
        !strcmp(op,"pixels") || !strcmp(op,"put") ? 3 : !strcmp(op,"audio") ? 4 : 5;
    profile_native[category] += SDL_GetPerformanceCounter() - start;
    profile_calls[category]++;
}
static void profile_report(int frames, Uint32 elapsed) {
    if (!profiling || !frames) return;
    fprintf(stdout,"PROFILE frames=%d elapsed_ms=%u fps=%.2f step_ms=%.3f present_ms=%.3f\n",
        frames,elapsed,elapsed?1000.*frames/elapsed:0,profile_step_ms/frames,profile_present_ms/frames);
    const char *names[]={"sprites","text","shapes","pixels","audio","state"};
    double factor=1000./SDL_GetPerformanceFrequency()/frames;
    for(int i=0;i<6;i++) fprintf(stdout,"PROFILE %s ms=%.3f calls=%.1f\n",names[i],profile_native[i]*factor,(double)profile_calls[i]/frames);
}
